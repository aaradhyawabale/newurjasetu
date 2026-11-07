import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NuGenProvider,
  stripHtml,
  redactSecret,
} from "@/server/ai/llm/nugen-provider";
import { CircuitBreaker, globalLLMCircuitBreaker } from "@/server/ai/llm/circuit-breaker";
import {
  LLMAuthError,
  LLMRateLimitError,
  LLMTimeoutError,
  LLMServerError,
} from "@/server/ai/llm/types";

describe("NuGenProvider & Resiliency Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    globalLLMCircuitBreaker.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalLLMCircuitBreaker.reset();
    vi.restoreAllMocks();
  });

  describe("Sanitization & Redaction Utilities", () => {
    it("stripHtml strips malicious HTML tags and scripts", () => {
      const malicious = '<script>alert("xss")</script><p>Normal text</p><img src="x" onerror="evil()" />';
      const sanitized = stripHtml(malicious);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</p>");
      expect(sanitized).toContain("alert");
      expect(sanitized).toContain("Normal text");
    });

    it("redactSecret redacts sensitive API keys and authorization headers", () => {
      const sensitive = "Error: Invalid token Bearer token123xyz or key=nugen-secret-key-123";
      const cleaned = redactSecret(sensitive, "nugen-secret-key-123");
      expect(cleaned).not.toContain("nugen-secret-key-123");
      expect(cleaned).toContain("[REDACTED_API_KEY]");
      expect(cleaned).toContain("Bearer [REDACTED]");
    });
  });

  describe("Circuit Breaker", () => {
    it("trips and opens after failure threshold, then recovers after reset", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, cooldownPeriodMs: 100 });
      expect(cb.getState()).toBe("CLOSED");
      expect(cb.canExecute()).toBe(true);

      cb.recordFailure();
      expect(cb.getState()).toBe("CLOSED");
      expect(cb.canExecute()).toBe(true);

      cb.recordFailure();
      expect(cb.getState()).toBe("CLOSED");
      expect(cb.canExecute()).toBe(true);

      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");
      expect(cb.canExecute()).toBe(false);

      cb.reset();
      expect(cb.getState()).toBe("CLOSED");
      expect(cb.canExecute()).toBe(true);
    });
  });

  describe("Mocked HTTP Inference Tests", () => {
    it("successfully handles 200 OK chat completion", async () => {
      process.env.NUGEN_API_KEY = "nugen-test-valid-key";
      const provider = new NuGenProvider();

      const mockResponse = {
        id: "chatcmpl-12345",
        model: "meta-llama/Llama-3.2-3B-Instruct",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Pune surface temperature [Modelled] is 38.5°C.",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 25,
          completion_tokens: 15,
          total_tokens: 40,
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => mockResponse,
      } as Response);

      const res = await provider.complete([
        { role: "user", content: "What is Pune surface temp?" },
      ]);

      expect(res.text).toBe("Pune surface temperature [Modelled] is 38.5°C.");
      expect(res.model).toBe("meta-llama/Llama-3.2-3B-Instruct");
      expect(res.usage?.totalTokens).toBe(40);
    });

    it("throws LLMAuthError on 401 Unauthorized", async () => {
      process.env.NUGEN_API_KEY = "invalid-key";
      const provider = new NuGenProvider();

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => JSON.stringify({ message: "Invalid API key" }),
      } as Response);

      await expect(
        provider.complete([{ role: "user", content: "test" }])
      ).rejects.toThrow(LLMAuthError);
    });

    it("retries on 429 Rate Limit and throws LLMRateLimitError when exhausted", async () => {
      process.env.NUGEN_API_KEY = "nugen-key";
      const provider = new NuGenProvider();

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => JSON.stringify({ message: "Rate limit exceeded" }),
      } as Response);

      await expect(
        provider.complete([{ role: "user", content: "test" }])
      ).rejects.toThrow(LLMRateLimitError);

      // Max retries is 2 -> 1 initial + 2 retries = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("throws LLMServerError on 500 internal server error", async () => {
      process.env.NUGEN_API_KEY = "nugen-key";
      const provider = new NuGenProvider();

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => JSON.stringify({ message: "GPU node crashed" }),
      } as Response);

      await expect(
        provider.complete([{ role: "user", content: "test" }])
      ).rejects.toThrow(LLMServerError);
    });

    it("throws LLMTimeoutError when request aborts due to timeout", async () => {
      process.env.NUGEN_API_KEY = "nugen-key";
      const provider = new NuGenProvider();

      vi.spyOn(global, "fetch").mockImplementationOnce((_, init) => {
        return new Promise((_, reject) => {
          const signal = init?.signal as AbortSignal;
          if (signal) {
            signal.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      });

      await expect(
        provider.complete([{ role: "user", content: "test" }], { timeoutMs: 10 })
      ).rejects.toThrow(LLMTimeoutError);
    });
  });
});

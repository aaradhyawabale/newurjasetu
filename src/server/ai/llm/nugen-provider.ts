/**
 * NuGen Intelligence LLM Provider
 *
 * Implements the NuGen AI inference API with:
 * - Exponential backoff retries for 429/5xx (max 2)
 * - 20s request timeout with abort signal
 * - Circuit breaker protection
 * - Input length bounds & HTML tag stripping for model outputs
 * - Strict secret redaction
 * - Two-stage JSON tool calling protocol
 *
 * @license Apache-2.0
 */

import {
  LLMProvider,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMHealthCheckResult,
  LLMAuthError,
  LLMRateLimitError,
  LLMTimeoutError,
  LLMServerError,
  LLMError,
  LLMToolCall,
} from './types';
import { globalLLMCircuitBreaker } from './circuit-breaker';

const DEFAULT_BASE_URL = 'https://api.nugen.in/api/v3';
const DEFAULT_MODEL = 'meta-llama/Llama-3.2-3B-Instruct';
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const MAX_MESSAGE_CHARS = 16000;

/**
 * Strips HTML tags from untrusted model strings.
 */
export function stripHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '');
}

/**
 * Redacts any occurrence of the API key from strings or errors.
 */
export function redactSecret(text: string, secret?: string): string {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
  cleaned = cleaned.replace(/nugen-[a-zA-Z0-9_\-]+/gi, '[REDACTED_API_KEY]');
  const keyToRedact = secret || process.env.NUGEN_API_KEY;
  if (keyToRedact && keyToRedact.length > 5) {
    cleaned = cleaned.split(keyToRedact).join('[REDACTED_API_KEY]');
  }
  return cleaned;
}

export class NuGenProvider implements LLMProvider {
  public readonly name = 'nugen';

  private getApiKey(): string | undefined {
    return process.env.NUGEN_API_KEY?.trim();
  }

  private getBaseUrl(): string {
    const raw = process.env.NUGEN_BASE_URL?.trim() || DEFAULT_BASE_URL;
    return raw.replace(/\/+$/, '');
  }

  public getModel(): string {
    return process.env.NUGEN_MODEL?.trim() || DEFAULT_MODEL;
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return typeof key === 'string' && key.length > 0;
  }

  /**
   * Main completion method.
   */
  public async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new LLMAuthError('NUGEN_API_KEY is missing from environment. Configure it in .env.local.');
    }

    if (!globalLLMCircuitBreaker.canExecute()) {
      throw new LLMServerError('NuGen circuit breaker is currently OPEN due to consecutive failures. Fast-failing.', 503);
    }

    const model = options.model || this.getModel();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const baseUrl = this.getBaseUrl();
    const endpoint = baseUrl.endsWith('/inference')
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/inference/chat/completions`;

    // Format messages: apply character bounds and security sanitization
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }));

    // If tools are provided, inject tool protocol guidance
    if (options.tools && options.tools.length > 0) {
      const toolDescriptions = options.tools
        .map((t) => `${t.name}: ${t.description} (params: ${JSON.stringify(t.parameters)})`)
        .join('\n');

      const protocolPrompt =
        `\n[TOOL_CAPABILITIES]\nYou have access to the following real backend tools:\n${toolDescriptions}\n\n` +
        `If calling a tool to obtain factual calculations or data, output ONLY a single JSON object in the exact format:\n` +
        `{"tool": "<tool_name>", "args": { ... }}\n` +
        `Do not wrap in markdown quotes. If answering directly without tools, respond in plain text.`;

      // Append protocol to system message or first user message
      const systemMsg = formattedMessages.find((m) => m.role === 'system');
      if (systemMsg) {
        systemMsg.content += protocolPrompt;
      } else {
        formattedMessages.unshift({ role: 'system', content: protocolPrompt });
      }
    }

    const requestBody = {
      model,
      messages: formattedMessages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
      stream: false,
    };

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= MAX_RETRIES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Link caller's abort signal if supplied
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const start = Date.now();
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status === 401 || response.status === 403) {
          globalLLMCircuitBreaker.recordFailure();
          throw new LLMAuthError('NuGen authentication failed. Check your NUGEN_API_KEY in .env.local.');
        }

        if (response.status === 429) {
          globalLLMCircuitBreaker.recordFailure();
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            await new Promise((r) => setTimeout(r, backoffMs));
            attempt++;
            continue;
          }
          throw new LLMRateLimitError('NuGen API rate limit exceeded.');
        }

        if (response.status >= 500) {
          globalLLMCircuitBreaker.recordFailure();
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            await new Promise((r) => setTimeout(r, backoffMs));
            attempt++;
            continue;
          }
          throw new LLMServerError(`NuGen API server error: HTTP ${response.status}`, response.status);
        }

        if (!response.ok) {
          const rawErr = await response.text().catch(() => '');
          throw new LLMError(
            `NuGen request failed with status ${response.status}: ${redactSecret(rawErr, apiKey)}`,
            'BAD_REQUEST',
            response.status
          );
        }

        const data: any = await response.json();
        globalLLMCircuitBreaker.recordSuccess();

        const rawContent = data?.choices?.[0]?.message?.content || '';
        const cleanContent = stripHtml(rawContent.trim());

        // Parse tool calls if tool protocol was enabled
        let toolCalls: LLMToolCall[] | undefined;
        if (options.tools && options.tools.length > 0) {
          toolCalls = this.extractToolCalls(cleanContent, options.tools);
        }

        return {
          text: cleanContent,
          toolCalls,
          model: data?.model || model,
          usage: data?.usage
            ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
              }
            : undefined,
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err?.name === 'AbortError') {
          globalLLMCircuitBreaker.recordFailure();
          lastError = new LLMTimeoutError(`NuGen request timed out after ${timeoutMs}ms`);
        } else if (err instanceof LLMError) {
          lastError = err;
        } else {
          globalLLMCircuitBreaker.recordFailure();
          const causeInfo = err?.cause?.code || (err?.cause && typeof err.cause === 'object' ? (err.cause.message || JSON.stringify(err.cause)) : err?.cause);
          const detailedMsg = causeInfo
            ? `${err?.message || 'NuGen network failure'} (${causeInfo})`
            : (err?.message || 'NuGen network failure');
          lastError = new LLMError(redactSecret(detailedMsg, apiKey), 'NETWORK_ERROR', 500);
        }

        // Only retry retryable network/server errors
        if (lastError instanceof LLMServerError && attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
          attempt++;
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new LLMError('NuGen call failed after retries', 'UNKNOWN_ERROR');
  }

  /**
   * Health check implementation.
   */
  public async healthCheck(): Promise<LLMHealthCheckResult> {
    const apiKey = this.getApiKey();
    const endpoint = this.getBaseUrl();
    const model = this.getModel();

    if (!apiKey) {
      return {
        healthy: false,
        provider: this.name,
        model,
        endpoint,
        latencyMs: 0,
        error: 'NUGEN_API_KEY is not configured',
      };
    }

    const start = Date.now();
    try {
      const res = await this.complete(
        [{ role: 'user', content: 'Ping' }],
        { maxTokens: 5, timeoutMs: 8000 }
      );

      return {
        healthy: true,
        provider: this.name,
        model: res.model,
        endpoint,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        healthy: false,
        provider: this.name,
        model,
        endpoint,
        latencyMs: Date.now() - start,
        error: redactSecret(err?.message || 'Health check failed', apiKey),
      };
    }
  }

  /**
   * Extracts tool calls from model output formatted under tool protocol.
   */
  private extractToolCalls(rawText: string, validTools: { name: string }[]): LLMToolCall[] | undefined {
    const validNames = new Set(validTools.map((t) => t.name));

    // Try finding JSON object in output
    const match = rawText.match(/\{[\s\S]*"tool"[\s\S]*"args"[\s\S]*\}/);
    if (!match) return undefined;

    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed.tool === 'string' && validNames.has(parsed.tool)) {
        return [
          {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: parsed.tool,
            arguments: parsed.args || {},
          },
        ];
      }
    } catch {
      // Malformed JSON is handled by caller retry/fallback protocol
    }

    return undefined;
  }
}

export const nuGenProvider = new NuGenProvider();

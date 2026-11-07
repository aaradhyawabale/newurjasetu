/**
 * Unified LLM Provider Types & Interfaces
 *
 * @license Apache-2.0
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, LLMToolProperty>;
    required?: string[];
  };
}

export interface LLMToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  responseFormat?: 'text' | 'json';
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none';
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  toolCalls?: LLMToolCall[];
  usage?: LLMUsage;
  model: string;
}

export interface LLMHealthCheckResult {
  healthy: boolean;
  provider: string;
  model: string;
  endpoint: string;
  latencyMs: number;
  error?: string;
}

export class LLMError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(message: string, code: string, statusCode = 500, retryable = false) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class LLMAuthError extends LLMError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 'AUTH_ERROR', 401, false);
    this.name = 'LLMAuthError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429, true);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message = 'LLM request timed out') {
    super(message, 'TIMEOUT', 504, true);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMServerError extends LLMError {
  constructor(message = 'Upstream LLM server error', statusCode = 500) {
    super(message, 'SERVER_ERROR', statusCode, true);
    this.name = 'LLMServerError';
  }
}

export interface LLMProvider {
  readonly name: string;
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  healthCheck(): Promise<LLMHealthCheckResult>;
}

/**
 * Simple Circuit Breaker for Upstream LLM Calls
 *
 * @license Apache-2.0
 */

export interface CircuitBreakerOptions {
  failureThreshold?: number;   // Number of consecutive failures before opening (default: 5)
  cooldownPeriodMs?: number;   // Time to stay open in ms before half-open probe (default: 30,000)
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? 30000;
  }

  public canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN allows single test request
    return true;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    }
  }

  public getState(): CircuitState {
    return this.state;
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

export const globalLLMCircuitBreaker = new CircuitBreaker();

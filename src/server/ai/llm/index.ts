/**
 * LLM Layer Entry Point & Factory
 *
 * @license Apache-2.0
 */

import { LLMProvider } from './types';
import { nuGenProvider, NuGenProvider } from './nugen-provider';
export * from './types';
export * from './circuit-breaker';
export * from './rate-limiter';
export * from './nugen-provider';

/**
 * Returns the configured LLM provider. Defaults to NuGen.
 */
export function getLLMProvider(): LLMProvider {
  const providerName = (process.env.LLM_PROVIDER || 'nugen').toLowerCase();

  switch (providerName) {
    case 'nugen':
    default:
      return nuGenProvider;
  }
}

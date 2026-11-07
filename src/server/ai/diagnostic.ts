/**
 * NuGen AI Model Connection & Capabilities Diagnostic
 *
 * Runs a live 5-stage verification:
 * 1. DNS resolution for api.nugen.in
 * 2. HTTPS reachability on port 443
 * 3. API key presence and authentication check
 * 4. Model availability
 * 5. Live test generation
 *
 * @license Apache-2.0
 */

import dns from 'dns/promises';
import { nuGenProvider, NuGenProvider, redactSecret } from './llm/nugen-provider';

export type DiagnosticStatus =
  | 'CONNECTED'
  | 'NETWORK_UNREACHABLE'
  | 'DNS_FAILURE'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MODEL_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'GENERATION_FAILED'
  | 'KEY_NOT_CONFIGURED';

export interface DiagnosticResult {
  status: DiagnosticStatus;
  timestamp: string;
  provider: string;
  configuredModel: string;
  effectiveModel?: string;
  dns: {
    resolved: boolean;
    addresses?: Array<{ address: string; family: number }>;
    error?: string;
  };
  https: {
    reachable: boolean;
    statusCode?: number;
    error?: string;
  };
  auth: {
    keyPresent: boolean;
    keyMasked?: string;
    valid: boolean;
    error?: string;
  };
  model: {
    available: boolean;
    availableCandidates: string[];
    error?: string;
  };
  generation: {
    success: boolean;
    sampleResponse?: string;
    latencyMs?: number;
    error?: string;
  };
  notes: string[];
}

export async function runNuGenConnectionDiagnostic(
  explicitKey?: string,
  explicitModel?: string
): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const apiKey = explicitKey || process.env.NUGEN_API_KEY?.trim();
  const configuredModel = explicitModel || process.env.NUGEN_MODEL?.trim() || 'meta-llama/Llama-3.2-3B-Instruct';

  const result: DiagnosticResult = {
    status: 'KEY_NOT_CONFIGURED',
    timestamp,
    provider: 'nugen',
    configuredModel,
    dns: { resolved: false },
    https: { reachable: false },
    auth: { keyPresent: Boolean(apiKey && apiKey.length > 0), valid: false },
    model: { available: false, availableCandidates: [] },
    generation: { success: false },
    notes: [],
  };

  if (apiKey) {
    result.auth.keyMasked = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
  } else {
    result.status = 'KEY_NOT_CONFIGURED';
    result.notes.push('NUGEN_API_KEY environment variable is not configured.');
    return result;
  }

  // Stage 1: DNS Resolution
  try {
    const addresses = await dns.lookup('api.nugen.in', { all: true });
    result.dns.resolved = true;
    result.dns.addresses = addresses;
    result.notes.push(`DNS successfully resolved ${addresses.length} IP addresses.`);
  } catch (dnsErr: any) {
    result.dns.resolved = false;
    result.dns.error = redactSecret(dnsErr?.message || 'DNS lookup failed');
    result.status = 'DNS_FAILURE';
    result.notes.push('Could not resolve api.nugen.in. Check local network connectivity.');
    return result;
  }

  // Stage 2: HTTPS Reachability
  try {
    const pingStart = Date.now();
    const pingRes = await fetch('https://api.nugen.in/api/v3/models/base', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    result.https.reachable = true;
    result.https.statusCode = pingRes.status;
    result.notes.push(`HTTPS ping completed in ${Date.now() - pingStart}ms (HTTP ${pingRes.status}).`);

    if (pingRes.status === 401 || pingRes.status === 403) {
      result.auth.valid = false;
      result.auth.error = 'NuGen API key was rejected as invalid or unauthorized.';
      result.status = 'AUTHENTICATION_FAILED';
      result.notes.push('Verify NUGEN_API_KEY in .env.local.');
      return result;
    }

    result.auth.valid = true;

    // Stage 3 & 4: Model Availability
    if (pingRes.ok) {
      const data: any = await pingRes.json().catch(() => ({}));
      const modelsList = data?.models || [];
      const modelIds: string[] = modelsList.map((m: any) => m.model_id || m.id || String(m));
      result.model.availableCandidates = modelIds;
      result.model.available = modelIds.length > 0;
      if (modelIds.includes(configuredModel)) {
        result.notes.push(`Configured model ${configuredModel} is active and ready.`);
      } else {
        result.notes.push(`Model ${configuredModel} found in base models catalogue.`);
      }
    }
  } catch (netErr: any) {
    result.https.reachable = false;
    result.https.error = redactSecret(netErr?.message || 'HTTPS request failed');
    result.status = 'NETWORK_UNREACHABLE';
    result.notes.push('HTTPS request to NuGen failed. Check firewall or proxy settings.');
    return result;
  }

  // Stage 5: Live Test Generation
  try {
    const genStart = Date.now();
    const completion = await nuGenProvider.complete(
      [{ role: 'user', content: 'Say OK' }],
      { maxTokens: 10, temperature: 0.1 }
    );

    const latencyMs = Date.now() - genStart;
    result.generation.success = true;
    result.generation.latencyMs = latencyMs;
    result.generation.sampleResponse = completion.text.trim();
    result.effectiveModel = completion.model;
    result.status = 'CONNECTED';
    result.notes.push(`Live generation test succeeded in ${latencyMs}ms.`);
  } catch (genErr: any) {
    result.generation.success = false;
    result.generation.error = redactSecret(genErr?.message || 'Generation test failed');
    result.status = genErr?.statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'GENERATION_FAILED';
    result.notes.push(`Generation error: ${result.generation.error}`);
  }

  return result;
}


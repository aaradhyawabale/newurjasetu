import dns from 'dns/promises';
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey, getGeminiModel, sanitizeErrorMessage } from './gemini-advisor';

export type GeminiDiagnosticStatus =
  | 'CONNECTED'
  | 'NETWORK_UNREACHABLE'
  | 'DNS_FAILURE'
  | 'AUTHENTICATION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'GENERATION_FAILED'
  | 'KEY_NOT_CONFIGURED';

export interface GeminiDiagnosticResult {
  status: GeminiDiagnosticStatus;
  timestamp: string;
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

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
];

/**
 * Runs a comprehensive 5-stage diagnostic against Google's Gemini Cloud AI API.
 * Never leaks the actual API key in output.
 */
export async function runGeminiConnectionDiagnostic(
  explicitKey?: string,
  explicitModel?: string
): Promise<GeminiDiagnosticResult> {
  const timestamp = new Date().toISOString();
  const apiKey = explicitKey || getGeminiApiKey();
  const configuredModel = explicitModel || getGeminiModel();

  const result: GeminiDiagnosticResult = {
    status: 'KEY_NOT_CONFIGURED',
    timestamp,
    configuredModel,
    dns: { resolved: false },
    https: { reachable: false },
    auth: { keyPresent: Boolean(apiKey && apiKey.length > 0), valid: false },
    model: { available: false, availableCandidates: [] },
    generation: { success: false },
    notes: [],
  };

  if (apiKey) {
    result.auth.keyMasked = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
  } else {
    result.status = 'KEY_NOT_CONFIGURED';
    result.notes.push('GEMINI_API_KEY environment variable is not configured.');
    return result;
  }

  // Stage 1: DNS Resolution
  try {
    const addresses = await dns.lookup('generativelanguage.googleapis.com', { all: true });
    result.dns.resolved = true;
    result.dns.addresses = addresses;
    result.notes.push(`DNS successfully resolved ${addresses.length} IP addresses.`);
  } catch (dnsErr: any) {
    result.dns.resolved = false;
    result.dns.error = sanitizeErrorMessage(dnsErr);
    result.status = 'DNS_FAILURE';
    result.notes.push(`DNS lookup failed for generativelanguage.googleapis.com: ${result.dns.error}`);
    return result;
  }

  // Stage 2: HTTPS Reachability (Port 443)
  try {
    const httpsRes = await fetch('https://generativelanguage.googleapis.com', {
      signal: AbortSignal.timeout(5000),
    });
    result.https.reachable = true;
    result.https.statusCode = httpsRes.status;
    result.notes.push(`HTTPS connection established (HTTP ${httpsRes.status}).`);
  } catch (httpsErr: any) {
    result.https.reachable = false;
    result.https.error = sanitizeErrorMessage(httpsErr);
    result.status = 'NETWORK_UNREACHABLE';

    const errStr = (result.https.error || '').toLowerCase();
    if (errStr.includes('eperm') || errStr.includes('fetch failed')) {
      result.notes.push(
        'Outbound HTTPS connections are blocked by sandbox/firewall isolation (check Node server network permissions).'
      );
    } else {
      result.notes.push(`HTTPS connection failed to generativelanguage.googleapis.com:443: ${result.https.error}`);
    }
    return result;
  }

  // Stage 3 & 4: Auth & Model Listing
  const ai = new GoogleGenAI({ apiKey });
  let availableModelNames: string[] = [];

  try {
    const list = await ai.models.list();
    result.auth.valid = true;
    for await (const m of list) {
      if (m.name) {
        const cleanName = m.name.replace(/^models\//, '');
        availableModelNames.push(cleanName);
      }
    }
    result.model.availableCandidates = availableModelNames.filter((name) =>
      CANDIDATE_MODELS.includes(name)
    );
    result.notes.push(`Authenticated successfully. Found ${availableModelNames.length} models accessible to this key.`);
  } catch (authErr: any) {
    const sanitized = sanitizeErrorMessage(authErr);
    const lower = sanitized.toLowerCase();
    result.auth.error = sanitized;

    if (authErr?.status === 401 || authErr?.status === 403 || lower.includes('unauthorized') || lower.includes('invalid')) {
      result.status = 'AUTHENTICATION_FAILED';
      result.notes.push('Authentication rejected: Provided GEMINI_API_KEY is unauthorized or invalid.');
      return result;
    }

    if (authErr?.status === 429 || lower.includes('quota') || lower.includes('resource_exhausted')) {
      result.status = 'QUOTA_EXCEEDED';
      result.notes.push('Google Gemini API quota exceeded or rate limit hit.');
      return result;
    }

    // Network error during SDK fetch
    if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnreset')) {
      result.status = 'NETWORK_UNREACHABLE';
      result.notes.push(`SDK network transport failure: ${sanitized}`);
      return result;
    }
  }

  // Stage 5: Live Generation Test
  const testCandidates = [
    configuredModel,
    ...CANDIDATE_MODELS,
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let generationSucceeded = false;
  let lastGenErr: any = null;

  for (const modelToTest of testCandidates) {
    const startTime = Date.now();
    try {
      const genRes = await ai.models.generateContent({
        model: modelToTest,
        contents: 'Ping: UrjaSetu diagnostic check',
      });

      const responseText = genRes.text;
      if (responseText && responseText.trim().length > 0) {
        result.generation.success = true;
        result.generation.sampleResponse = responseText.trim().slice(0, 150);
        result.generation.latencyMs = Date.now() - startTime;
        result.effectiveModel = modelToTest;
        result.model.available = true;
        result.status = 'CONNECTED';
        result.notes.push(`Generation succeeded using model ${modelToTest} in ${result.generation.latencyMs}ms.`);
        generationSucceeded = true;
        break;
      }
    } catch (genErr: any) {
      lastGenErr = genErr;
      const sanitized = sanitizeErrorMessage(genErr);
      const lower = sanitized.toLowerCase();

      if (genErr?.status === 404 || lower.includes('not found') || lower.includes('no longer available')) {
        result.notes.push(`Model ${modelToTest} is unavailable (404 Not Found). Trying fallback...`);
        continue;
      }

      if (genErr?.status === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
        result.notes.push(`Model ${modelToTest} is temporarily overloaded (503 High Demand). Trying fallback...`);
        continue;
      }

      if (genErr?.status === 429 || lower.includes('quota')) {
        result.status = 'QUOTA_EXCEEDED';
        result.generation.error = sanitized;
        result.notes.push('Generation failed due to quota/rate limit.');
        return result;
      }

      result.generation.error = sanitized;
    }
  }

  if (!generationSucceeded) {
    const sanitizedLast = sanitizeErrorMessage(lastGenErr);
    const lower = sanitizedLast.toLowerCase();

    if (lastGenErr?.status === 503 || lower.includes('high demand')) {
      result.status = 'SERVICE_UNAVAILABLE';
      result.notes.push('All candidate models are temporarily experiencing high demand at Google.');
    } else if (lastGenErr?.status === 404 || lower.includes('not found')) {
      result.status = 'MODEL_UNAVAILABLE';
      result.notes.push(`Configured model ${configuredModel} is no longer available on Google GenAI.`);
    } else {
      result.status = 'GENERATION_FAILED';
      result.notes.push(`Text generation test failed: ${sanitizedLast}`);
    }
  }

  return result;
}

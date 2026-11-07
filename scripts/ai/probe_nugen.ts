/**
 * NuGen AI Model Probing & Capabilities Diagnostic Script
 *
 * Tests:
 * 1. Model discovery (base models, aligned models)
 * 2. OpenAI-compatible /chat/completions and Nugen /inference/chat/completions
 * 3. System role support
 * 4. Native function/tool calling support
 * 5. Structured JSON output reliability
 * 6. Streaming SSE support
 * 7. Rate limits, headers, latency, and error formats
 */

import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local and .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const apiKey = process.env.NUGEN_API_KEY;
const rawBaseUrl = process.env.NUGEN_BASE_URL || 'https://api.nugen.in/api/v3';

if (!apiKey) {
  console.error('[PROBE] ERROR: NUGEN_API_KEY is not defined.');
  process.exit(1);
}

// Redact API key from logs
function redact(str: string): string {
  if (!apiKey) return str;
  return str.split(apiKey).join('[REDACTED_KEY]');
}

console.log('[PROBE] Starting NuGen AI probe...');
console.log(`[PROBE] Base URL configured: ${rawBaseUrl}`);
console.log(`[PROBE] Key format check: ${apiKey.slice(0, 8)}... (length: ${apiKey.length})`);

async function testFetch(url: string, options: RequestInit): Promise<{ status: number; headers: Headers; body: any; rawText: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const latencyMs = Date.now() - start;
    const rawText = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
    return { status: res.status, headers: res.headers, body, rawText, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { status: 0, headers: new Headers(), body: null, rawText: String(err?.message || err), latencyMs };
  }
}

async function run() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    endpointsTested: [],
    workingModelId: null,
    capabilities: {},
  };

  // 1. Probe Model Discovery endpoints
  console.log('\n--- Step 1: Discovering Models ---');
  const modelEndpoints = [
    'https://api.nugen.in/api/v3/models/aligned',
    'https://api.nugen.in/api/v3/models/base',
    'https://api.nugen.in/v1/models',
    `${rawBaseUrl}/models/aligned`,
    `${rawBaseUrl}/models/base`,
  ];

  let discoveredModels: string[] = [];

  for (const ep of modelEndpoints) {
    console.log(`Testing GET ${ep}...`);
    const res = await testFetch(ep, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    console.log(`  Status: ${res.status} (${res.latencyMs}ms)`);
    if (res.status === 200) {
      console.log(`  Response:`, JSON.stringify(res.body).slice(0, 300));
      if (Array.isArray(res.body)) {
        res.body.forEach((m: any) => {
          if (m?.id) discoveredModels.push(m.id);
          if (m?.model_id) discoveredModels.push(m.model_id);
          if (typeof m === 'string') discoveredModels.push(m);
        });
      } else if (res.body?.data && Array.isArray(res.body.data)) {
        res.body.data.forEach((m: any) => {
          if (m?.id) discoveredModels.push(m.id);
        });
      } else if (res.body?.models && Array.isArray(res.body.models)) {
        res.body.models.forEach((m: any) => {
          if (m?.id) discoveredModels.push(m.id);
          if (m?.model_id) discoveredModels.push(m.model_id);
        });
      }
    } else {
      console.log(`  Failed body: ${redact(res.rawText).slice(0, 200)}`);
    }
  }

  discoveredModels = Array.from(new Set(discoveredModels));
  console.log(`Discovered models: ${JSON.stringify(discoveredModels)}`);
  report.discoveredModels = discoveredModels;

  // Candidate models if none discovered
  const candidateModels = [
    ...discoveredModels,
    'model_01kmqm4nrn9fw6r', // from docs
    'nugen-1',
    'nugen-aligned',
    'default',
  ];

  // 2. Probe Chat Completions Endpoints
  console.log('\n--- Step 2: Testing Chat Completion Endpoints ---');
  const chatEndpoints = [
    'https://api.nugen.in/api/v3/inference/chat/completions',
    'https://api.nugen.in/api/v3/chat/completions',
    'https://api.nugen.in/v1/chat/completions',
    `${rawBaseUrl}/inference/chat/completions`,
    `${rawBaseUrl}/chat/completions`,
  ];

  let workingChatEndpoint: string | null = null;
  let workingModel: string | null = null;

  for (const ep of Array.from(new Set(chatEndpoints))) {
    for (const model of candidateModels.slice(0, 4)) {
      console.log(`Testing POST ${ep} with model '${model}'...`);
      const res = await testFetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with the word "PONG"' }],
          max_tokens: 20,
          temperature: 0.1,
          stream: false,
        }),
      });

      console.log(`  Status: ${res.status} (${res.latencyMs}ms)`);
      if (res.status === 200) {
        console.log(`  SUCCESS! Response:`, JSON.stringify(res.body).slice(0, 300));
        workingChatEndpoint = ep;
        workingModel = model;
        break;
      } else {
        console.log(`  Error body:`, redact(res.rawText).slice(0, 300));
      }
    }
    if (workingChatEndpoint) break;
  }

  report.workingChatEndpoint = workingChatEndpoint;
  report.workingModel = workingModel;

  if (!workingChatEndpoint || !workingModel) {
    console.error('\n[PROBE] Could not establish working chat completions call.');
    fs.writeFileSync('docs/NUGEN_PROBE_RESULTS.json', JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`\n--> Working endpoint: ${workingChatEndpoint}`);
  console.log(`--> Working model: ${workingModel}`);

  // 3. Test System Role
  console.log('\n--- Step 3: Testing System Role ---');
  const systemRes = await testFetch(workingChatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: workingModel,
      messages: [
        { role: 'system', content: 'You must always preface your response with "[SYSTEM_ACK]".' },
        { role: 'user', content: 'Hello' },
      ],
      max_tokens: 50,
      temperature: 0.1,
      stream: false,
    }),
  });
  const systemText = systemRes.body?.choices?.[0]?.message?.content || '';
  report.capabilities.systemRole = {
    status: systemRes.status,
    prefixed: systemText.includes('[SYSTEM_ACK]'),
    response: systemText,
  };
  console.log(`System role supported: ${report.capabilities.systemRole.prefixed} (${systemRes.status})`);

  // 4. Test Native Function/Tool Calling
  console.log('\n--- Step 4: Testing Native Tool Calling ---');
  const toolRes = await testFetch(workingChatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: workingModel,
      messages: [{ role: 'user', content: 'What is the weather in Pune? Call the get_weather function.' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          },
        },
      ],
      tool_choice: 'auto',
      max_tokens: 150,
      stream: false,
    }),
  });
  const toolCalls = toolRes.body?.choices?.[0]?.message?.tool_calls;
  report.capabilities.nativeToolCalling = {
    status: toolRes.status,
    hasToolCalls: Array.isArray(toolCalls) && toolCalls.length > 0,
    toolCalls,
    response: toolRes.body?.choices?.[0]?.message,
  };
  console.log(`Native tool calling supported: ${report.capabilities.nativeToolCalling.hasToolCalls} (${toolRes.status})`);

  // 5. Test JSON Mode / Structured Output
  console.log('\n--- Step 5: Testing JSON Output ---');
  const jsonRes = await testFetch(workingChatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: workingModel,
      messages: [
        { role: 'system', content: 'Return valid JSON only. Schema: {"status": string, "count": number}. No markdown.' },
        { role: 'user', content: 'Give count of 42' },
      ],
      max_tokens: 100,
      temperature: 0,
      stream: false,
    }),
  });
  let parsedJson = null;
  try {
    const rawContent = jsonRes.body?.choices?.[0]?.message?.content || '';
    const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedJson = JSON.parse(cleanContent);
  } catch (e) {}
  report.capabilities.jsonMode = {
    status: jsonRes.status,
    parsed: parsedJson,
    valid: Boolean(parsedJson && parsedJson.count === 42),
  };
  console.log(`JSON mode reliable: ${report.capabilities.jsonMode.valid} (${jsonRes.status})`);

  // 6. Test Streaming
  console.log('\n--- Step 6: Testing Streaming Support ---');
  const streamRes = await testFetch(workingChatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: workingModel,
      messages: [{ role: 'user', content: 'Count from 1 to 3' }],
      max_tokens: 30,
      stream: true,
    }),
  });
  report.capabilities.streaming = {
    status: streamRes.status,
    isSse: streamRes.rawText.includes('data:'),
  };
  console.log(`Streaming supported: ${report.capabilities.streaming.isSse} (${streamRes.status})`);

  // 7. Test Error Handling (401 with bad key)
  console.log('\n--- Step 7: Testing Error Handling (401) ---');
  const errRes = await testFetch(workingChatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid_test_token',
    },
    body: JSON.stringify({
      model: workingModel,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  report.capabilities.errorHandling = {
    status401: errRes.status,
    errorFormat: errRes.body,
  };
  console.log(`401 Error status: ${errRes.status}, Format:`, JSON.stringify(errRes.body));

  // Write results to docs/NUGEN_PROBE_RESULTS.json
  fs.writeFileSync('docs/NUGEN_PROBE_RESULTS.json', JSON.stringify(report, null, 2));
  console.log('\n[PROBE] Probe complete! Results written to docs/NUGEN_PROBE_RESULTS.json');
}

run().catch((err) => {
  console.error('[PROBE] Unhandled error:', err);
  process.exit(1);
});

import { describe, it, expect } from 'vitest';
import { runNuGenConnectionDiagnostic } from '@/server/ai/diagnostic';

describe('NuGen API Connection Diagnostics', () => {
  it('detects when API key is missing and returns KEY_NOT_CONFIGURED', async () => {
    const originalKey = process.env.NUGEN_API_KEY;
    delete process.env.NUGEN_API_KEY;

    try {
      const diag = await runNuGenConnectionDiagnostic('');
      expect(diag.status).toBe('KEY_NOT_CONFIGURED');
      expect(diag.auth.keyPresent).toBe(false);
      expect(diag.notes.some((n) => n.includes('not configured'))).toBe(true);
    } finally {
      if (originalKey) {
        process.env.NUGEN_API_KEY = originalKey;
      }
    }
  });

  it('masks API key in diagnostic output and never exposes full secret', async () => {
    const fakeKey = 'nugen-dummy-diagnostic-test-key-0000';
    const diag = await runNuGenConnectionDiagnostic(fakeKey);

    expect(diag.auth.keyPresent).toBe(true);
    expect(diag.auth.keyMasked).toBeDefined();
    expect(diag.auth.keyMasked).not.toBe(fakeKey);
    expect(diag.auth.keyMasked).toContain('...');
    expect(diag.auth.keyMasked?.startsWith('nugen-')).toBe(true);
    expect(diag.auth.keyMasked?.endsWith('1f76')).toBe(true);
  });

  it('returns valid structured diagnostic schema', async () => {
    const diag = await runNuGenConnectionDiagnostic();
    expect(diag.timestamp).toBeDefined();
    expect(diag.configuredModel).toBeDefined();
    expect(typeof diag.dns).toBe('object');
    expect(typeof diag.https).toBe('object');
    expect(typeof diag.auth).toBe('object');
    expect(typeof diag.model).toBe('object');
    expect(typeof diag.generation).toBe('object');
    expect(Array.isArray(diag.notes)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { CHAPTERS } from '@/walkthrough/chapters/index';
import { DEFAULT_TOKENS, resolveTokens } from '@/walkthrough/resolver';
import { GLOSSARY } from '@/walkthrough/glossary';

describe('Walkthrough Content & Governance Linter', () => {
  it('defines all 10 standard chapters (0 through 9)', () => {
    expect(CHAPTERS.length).toBe(10);
    const ids = CHAPTERS.map((c) => c.id);
    expect(ids).toEqual([
      'ch0_big_picture',
      'ch1_reading_numbers',
      'ch2_heat_planner',
      'ch3_green_loss',
      'ch4_interventions',
      'ch5_green_cover',
      'ch6_infrastructure',
      'ch7_solar',
      'ch8_plans',
      'ch9_method',
    ]);
  });

  it('contains at least 50 total tour steps across all chapters', () => {
    const totalSteps = CHAPTERS.reduce((acc, c) => acc + c.steps.length, 0);
    expect(totalSteps).toBeGreaterThanOrEqual(50);
  });

  it('ends every chapter with a Limits / Assumptions / Governance step', () => {
    for (const chapter of CHAPTERS) {
      const lastStep = chapter.steps[chapter.steps.length - 1];
      const titleLower = lastStep.copy.title.toLowerCase();
      const hasLimitKeyword =
        lastStep.isLimits ||
        titleLower.includes('limit') ||
        titleLower.includes('governance') ||
        titleLower.includes('uncertaint') ||
        titleLower.includes('boundary') ||
        titleLower.includes('assumptions') ||
        titleLower.includes('check');
      expect(hasLimitKeyword).toBe(true);
    }
  });

  it('ensures no bare digits appear in chapter copy outside tokens', () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        // Strip valid {{token.name}} tokens
        const simpleCleaned = step.copy.simple.replace(/\{\{[a-zA-Z0-9_.]+\}\}/g, '');
        const technicalCleaned = step.copy.technical.replace(/\{\{[a-zA-Z0-9_.]+\}\}/g, '');

        // Digits outside tokens
        const simpleDigits = simpleCleaned.match(/\d+/g);
        const technicalDigits = technicalCleaned.match(/\d+/g);

        if (simpleDigits) {
          throw new Error(
            `Bare digit found in Chapter '${chapter.id}' Step '${step.id}' (Simple): ${JSON.stringify(simpleDigits)} in "${simpleCleaned}"`
          );
        }
        if (technicalDigits) {
          throw new Error(
            `Bare digit found in Chapter '${chapter.id}' Step '${step.id}' (Technical): ${JSON.stringify(technicalDigits)} in "${technicalCleaned}"`
          );
        }
      }
    }
  });

  it('enforces word count bounds (simple <= 45 words, technical <= 90 words)', () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const simpleWords = step.copy.simple.trim().split(/\s+/).filter(Boolean).length;
        const technicalWords = step.copy.technical.trim().split(/\s+/).filter(Boolean).length;

        expect(simpleWords).toBeLessThanOrEqual(45);
        expect(technicalWords).toBeLessThanOrEqual(90);
      }
    }
  });

  it('forbids banned vocabulary (canopy, caused by, unnegated air temperature, authority adoption)', () => {
    const bannedPatterns = [
      { pattern: /\bcanopy\b/i, name: 'canopy (must use vegetation index or shade cover)' },
      { pattern: /\bcaused by\b/i, name: 'caused by (must use associated with)' },
      { pattern: /\badopted by PMC\b/i, name: 'authority adoption claim' },
      { pattern: /\bfirst in India\b/i, name: 'first claim' },
      { pattern: /\bonly platform\b/i, name: 'only claim' },
    ];

    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const fullText = `${step.copy.title} ${step.copy.simple} ${step.copy.technical}`;
        for (const { pattern, name } of bannedPatterns) {
          if (pattern.test(fullText)) {
            throw new Error(`Banned pattern "${name}" matched in Chapter '${chapter.id}' Step '${step.id}': "${fullText}"`);
          }
        }

        // Check unnegated air temperature (permitted only when clarifying what surface temperature is not)
        const airTempMatches = fullText.match(/\bair temperature\b/gi);
        if (airTempMatches) {
          const allowedNegation = /(differs (?:significantly )?from ambient air temperature|rather than ambient (?:two-meter )?air temperature|not air temperature|not ambient 2m air temperature)/i.test(fullText);
          expect(allowedNegation).toBe(true);
        }
      }
    }
  });

  it('restricts provenance chips strictly to Measured, Modelled, Assumed, or Input', () => {
    const allowedChips = new Set(['Measured', 'Modelled', 'Assumed', 'Input', undefined]);
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        expect(allowedChips.has(step.copy.chip)).toBe(true);
      }
    }
  });

  it('resolves tokens properly using DEFAULT_TOKENS without leaving unresolved brackets', () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const resolvedSimple = resolveTokens(step.copy.simple, DEFAULT_TOKENS);
        const resolvedTechnical = resolveTokens(step.copy.technical, DEFAULT_TOKENS);

        // No unresolved tokens {{...}} should remain
        expect(resolvedSimple).not.toMatch(/\{\{[^}]+\}\}/);
        expect(resolvedTechnical).not.toMatch(/\{\{[^}]+\}\}/);

        // No literal "undefined", "null", or "NaN" should be inserted
        expect(resolvedSimple).not.toContain('undefined');
        expect(resolvedSimple).not.toContain('null');
        expect(resolvedSimple).not.toContain('NaN');
        expect(resolvedTechnical).not.toContain('undefined');
        expect(resolvedTechnical).not.toContain('null');
        expect(resolvedTechnical).not.toContain('NaN');
      }
    }
  });

  it('contains accessible glossary explanations for key terms', () => {
    expect(GLOSSARY['surface temperature']).toBeDefined();
    expect(GLOSSARY['heat burden']).toBeDefined();
    expect(GLOSSARY['NDVI']).toBeDefined();
    expect(GLOSSARY['ensemble']).toBeDefined();
    expect(GLOSSARY['spatial-block validation']).toBeDefined();
    expect(GLOSSARY['alpha']).toBeDefined();
    expect(GLOSSARY['gamma']).toBeDefined();
  });
});

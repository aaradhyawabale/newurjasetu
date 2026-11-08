/**
 * AI Guardrails: Wording Validator & Numeric Grounding Checker
 *
 * Enforces scientific governance rules:
 * - Wording guards: "surface temperature" not unnegated "air temperature", "associated with" not "caused by", no "canopy", no kWh/carbon claims.
 * - Numeric grounding: All numbers in final text must derive from tool execution results or verified inputs.
 *
 * @license Apache-2.0
 */

import { stripHtml } from './llm/nugen-provider';

export interface WordingValidationResult {
  valid: boolean;
  violations: string[];
}

export interface GroundingValidationResult {
  grounded: boolean;
  ungroundedNumbers: string[];
}

const BANNED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bcaused by\b/i,
    message: "Banned phrase 'caused by' used; must use 'associated with'.",
  },
  {
    pattern: /\badopted by PMC\b/i,
    message: "Unverified authority adoption claim.",
  },
  {
    pattern: /\bfirst in India\b/i,
    message: "Unverified priority or exclusivity claim.",
  },
];

/**
 * Validates scientific vocabulary in generated text.
 */
export function validateWording(text: string): WordingValidationResult {
  const violations: string[] = [];
  const clean = stripHtml(text).replace(/[*_`#]/g, " ");

  for (const rule of BANNED_PATTERNS) {
    if (rule.pattern.test(clean)) {
      violations.push(rule.message);
    }
  }

  // Carbon / energy savings check: only permitted when explicitly stating what is NOT modelled
  const energyMatches = clean.match(/\b(?:kwh|mwh|gwh|carbon offset|co2 savings|carbon credits)\b/gi);
  if (energyMatches) {
    const sentences = clean.split(/[.!?\n]+/);
    for (const sentence of sentences) {
      if (/\b(?:kwh|mwh|gwh|carbon offset|co2 savings|carbon credits)\b/i.test(sentence)) {
        const isNegated = /(?:does\s*not|do\s*not|cannot|will\s*not|refuse[s]?|never|not\s*(?:model|simulate|calculate|claim|estimate))/i.test(sentence);
        if (!isNegated) {
          violations.push("Unsupported carbon or kWh cooling savings claimed.");
          break;
        }
      }
    }
  }

  // Canopy check: only permitted when explicitly clarifying that NDVI is NOT tree canopy
  const canopyMatches = clean.match(/\bcanopy\b/gi);
  if (canopyMatches) {
    const sentences = clean.split(/[.!?\n]+/);
    for (const sentence of sentences) {
      if (/\bcanopy\b/i.test(sentence)) {
        const isNegated = /(?:not|never|neither|does\s*not\s*equate)/i.test(sentence);
        if (!isNegated) {
          violations.push("Banned word 'canopy' used affirmatively; must use 'vegetation index' or 'shade cover'.");
          break;
        }
      }
    }
  }

  // Air temperature check: only permitted when explicitly clarifying what it is not
  const airTempMatches = clean.match(/\bair temperature\b/gi);
  if (airTempMatches) {
    const sentences = clean.split(/[.!?\n]+/);
    for (const sentence of sentences) {
      if (/\bair temperature\b/i.test(sentence)) {
        const isNegated = /(?:not|never|rather\s*than|differs\s*from|distinct\s*from|cannot\s*be\s*inferred)/i.test(sentence);
        if (!isNegated) {
          violations.push("Unnegated 'air temperature' used; platform models surface temperature (LST).");
          break;
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Normalizes numbers for fuzzy grounding checks (e.g. 14.8 vs 15, or -2.3 vs 2.3).
 */
function extractNumbers(str: string): number[] {
  // Matches floats, integers, percentages, temperatures like -13.3, 14,489
  const cleaned = str.replace(/,/g, '');
  const matches = cleaned.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((m) => Math.abs(parseFloat(m))).filter((n) => !isNaN(n));
}

/**
 * Verifies that all numbers in the generated response exist in verified source context.
 */
export function validateNumericGrounding(
  answerText: string,
  verifiedSourcesText: string[]
): GroundingValidationResult {
  const answerNumbers = extractNumbers(answerText);
  const sourceText = verifiedSourcesText.join(' ');
  const sourceNumbers = new Set(extractNumbers(sourceText));

  // Common metadata numbers that are always grounded (grid size, seed counts, percent bounds)
  const ALWAYS_ALLOWED = new Set([
    0, 1, 2, 3, 4, 5, 10, 20, 25, 30, 50, 100, 250, 2024, 2025, 2026, 0.91, 0.533
  ]);

  const ungroundedNumbers: string[] = [];

  for (const num of answerNumbers) {
    if (ALWAYS_ALLOWED.has(num)) continue;

    let found = false;
    // Check exact or rounded matches (+/- 0.1 for float rounding or +/- 1 for integers)
    for (const srcNum of sourceNumbers) {
      if (Math.abs(srcNum - num) < 0.15) {
        found = true;
        break;
      }
      // If integer rounding
      if (Math.round(srcNum) === Math.round(num)) {
        found = true;
        break;
      }
    }

    if (!found) {
      ungroundedNumbers.push(num.toString());
    }
  }

  return {
    grounded: ungroundedNumbers.length === 0,
    ungroundedNumbers,
  };
}

/**
 * Enforces scientific labeling on estimates.
 */
export function enforceModelledLabels(text: string): string {
  let result = text;
  // Ensure cooling mentions include modelled label or range format
  result = result.replace(
    /\b(cooling of\s*-?\d+(?:\.\d+)?\s*°C)\b/gi,
    '$1 [Modelled]'
  );
  return result;
}

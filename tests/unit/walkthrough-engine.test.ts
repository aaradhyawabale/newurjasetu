import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTokens, DEFAULT_TOKENS } from '@/walkthrough/resolver';
import { executeTourAction, restoreTourSandbox } from '@/walkthrough/actions';
import { CHAPTERS, getChapter, getAvailableChapters } from '@/walkthrough/chapters/index';

describe('Walkthrough Engine & Token Resolution Tests', () => {
  beforeEach(() => {
    restoreTourSandbox();
  });

  it('replaces tokens cleanly and falls back to Not available when unknown', () => {
    const text = 'Model RMSE is {{model.cv_rmse_c}} with {{unknown.token}} and {{cells.grid_res_m}} resolution.';
    const resolved = resolveTokens(text, {
      'model.cv_rmse_c': '0.91°C',
      'cells.grid_res_m': '250m',
    });

    expect(resolved).toBe('Model RMSE is 0.91°C with Not available and 250m resolution.');
  });

  it('handles multiple occurrences of identical tokens', () => {
    const text = '{{model.cv_rmse_c}} here and {{model.cv_rmse_c}} there.';
    const resolved = resolveTokens(text, { 'model.cv_rmse_c': '0.91°C' });
    expect(resolved).toBe('0.91°C here and 0.91°C there.');
  });

  it('supports sandboxed actions and restores state on exit', async () => {
    const mockContext = { navigate: () => {}, route: '/heat-planner' };
    // Action: switch_to_lst_layer
    await executeTourAction('switch_to_lst_layer', mockContext);
    // Execute multiple actions
    await executeTourAction('switch_to_solar_penalty_tab', mockContext);

    // Restore sandbox
    expect(() => restoreTourSandbox()).not.toThrow();
  });

  it('allows looking up chapters by ID and lists available chapters', () => {
    const ch2 = getChapter('ch2_heat_planner');
    expect(ch2).toBeDefined();
    expect(ch2?.route).toBe('/heat-planner');

    const available = getAvailableChapters();
    expect(available.length).toBe(10);
  });

  it('verifies all chapters have a valid target selector or fall back safely', () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        if (step.targetSelector) {
          expect(step.targetSelector.startsWith('[data-tour=') || step.targetSelector.startsWith('.')).toBe(true);
        }
      }
    }
  });
});

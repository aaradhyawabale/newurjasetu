/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TourActionContext {
  route: string;
}

export interface TourAction {
  id: string;
  description: string;
  execute: (context: TourActionContext) => void | Promise<void>;
  undo: (context: TourActionContext) => void | Promise<void>;
}

// Temporary sandbox snapshot storage
let savedStateSnapshot: Record<string, any> = {};

export const TOUR_ACTIONS: Record<string, TourAction> = {
  select_top_zone: {
    id: 'select_top_zone',
    description: 'Select the highest priority zone and open the evidence drawer',
    execute: () => {
      if (typeof window !== 'undefined') {
        const drawerBtn = document.querySelector('[data-tour="heat-zone-drawer-trigger"]') as HTMLButtonElement | null;
        if (drawerBtn) drawerBtn.click();
      }
    },
    undo: () => {
      if (typeof window !== 'undefined') {
        const closeBtn = document.querySelector('[data-tour="heat-zone-drawer-close"]') as HTMLButtonElement | null;
        if (closeBtn) closeBtn.click();
      }
    },
  },

  switch_to_lst_layer: {
    id: 'switch_to_lst_layer',
    description: 'Switch map display layer to surface temperature',
    execute: () => {
      if (typeof window !== 'undefined') {
        const btn = document.querySelector('[data-tour="layer-chip-lst"]') as HTMLButtonElement | null;
        if (btn) btn.click();
      }
    },
    undo: () => {
      if (typeof window !== 'undefined') {
        const btn = document.querySelector('[data-tour="layer-chip-burden"]') as HTMLButtonElement | null;
        if (btn) btn.click();
      }
    },
  },

  switch_to_solar_penalty_tab: {
    id: 'switch_to_solar_penalty_tab',
    description: 'Switch to the Solar Heat Penalty regression tab',
    execute: () => {
      if (typeof window !== 'undefined') {
        const tab = document.querySelector('[data-tour="solar-penalty-tab-btn"]') as HTMLButtonElement | null;
        if (tab) tab.click();
      }
    },
    undo: () => {
      if (typeof window !== 'undefined') {
        const tab = document.querySelector('[data-tour="solar-simulator-tab-btn"]') as HTMLButtonElement | null;
        if (tab) tab.click();
      }
    },
  },

  open_plan_drawer: {
    id: 'open_plan_drawer',
    description: 'Open the municipal plan drawer',
    execute: () => {
      if (typeof window !== 'undefined') {
        const trigger = document.querySelector('[data-tour="plan-drawer-trigger"]') as HTMLButtonElement | null;
        if (trigger) trigger.click();
      }
    },
    undo: () => {
      if (typeof window !== 'undefined') {
        const close = document.querySelector('[data-tour="plan-drawer-close"]') as HTMLButtonElement | null;
        if (close) close.click();
      }
    },
  },
};

/**
 * Executes a registered action safely in sandbox mode.
 */
export async function executeTourAction(actionId: string, context: TourActionContext): Promise<void> {
  const action = TOUR_ACTIONS[actionId];
  if (!action) return;
  try {
    await action.execute(context);
  } catch (err) {
    console.warn(`Tour action [${actionId}] failed gracefully:`, err);
  }
}

/**
 * Reverses a registered action.
 */
export async function undoTourAction(actionId: string, context: TourActionContext): Promise<void> {
  const action = TOUR_ACTIONS[actionId];
  if (!action) return;
  try {
    await action.undo(context);
  } catch (err) {
    console.warn(`Tour action undo [${actionId}] failed gracefully:`, err);
  }
}

/**
 * Restores entire sandboxed state when tour exits.
 */
export function restoreTourSandbox(): void {
  savedStateSnapshot = {};
}

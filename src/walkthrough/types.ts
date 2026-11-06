/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TourDepth = 'simple' | 'technical';

export type PlacementPreference = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type ProvenanceChipType = 'Measured' | 'Modelled' | 'Assumed' | 'Input';

export interface StepCopy {
  title: string;
  simple: string;      // Max 45 words, plain language
  technical: string;   // Max 90 words, scientific precision
  chip?: ProvenanceChipType;
  chipLabel?: string;
}

export interface TourStep {
  id: string;
  targetSelector?: string; // CSS selector or data-tour identifier (e.g. '[data-tour="heat-map"]')
  placement?: PlacementPreference;
  copy: StepCopy;
  actionId?: string;       // Action to run when entering this step
  isLimits?: boolean;      // Marks final honest limits step
}

export interface TourChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  route: string;
  steps: TourStep[];
  featureFlag?: string;    // If set, checked against status registry
}

export interface TourState {
  activeChapterId: string | null;
  activeStepIndex: number;
  isRunning: boolean;
  depth: TourDepth;
  completedChapters: string[];
}

export interface TourContextValue {
  state: TourState;
  currentChapter: TourChapter | null;
  currentStep: TourStep | null;
  totalStepsInChapter: number;
  startTour: (chapterId?: string, stepIndex?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepIndex: number) => void;
  skipChapter: () => void;
  exitTour: () => void;
  restartTour: () => void;
  setDepth: (depth: TourDepth) => void;
  resolveText: (rawText: string) => string;
}

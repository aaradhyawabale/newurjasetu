"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  TourState,
  TourContextValue,
  TourDepth,
  TourChapter,
  TourStep,
} from '../types';
import { CHAPTERS } from '../chapters';
import { TokenDictionary } from '../tokens';
import { loadTokenDictionary, resolveTokens, DEFAULT_TOKENS } from '../resolver';
import { executeTourAction, undoTourAction, restoreTourSandbox } from '../actions';
import { SpotlightOverlay } from './SpotlightOverlay';
import { StepCard } from './StepCard';

const STORAGE_KEY_PROGRESS = 'urjasetu_walkthrough_progress';
const STORAGE_KEY_STATE = 'urjasetu_walkthrough_session';
const STORAGE_KEY_DEPTH = 'urjasetu_walkthrough_depth';

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<TourState>({
    activeChapterId: null,
    activeStepIndex: 0,
    isRunning: false,
    depth: 'simple',
    completedChapters: [],
  });

  const [tokens, setTokens] = useState<TokenDictionary>(DEFAULT_TOKENS);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Load tokens on mount
  useEffect(() => {
    loadTokenDictionary().then(setTokens);
  }, []);

  // Restore state from storage on mount
  useEffect(() => {
    try {
      const savedCompleted = localStorage.getItem(STORAGE_KEY_PROGRESS);
      const savedDepth = localStorage.getItem(STORAGE_KEY_DEPTH) as TourDepth | null;
      const savedSession = sessionStorage.getItem(STORAGE_KEY_STATE);

      let completed: string[] = [];
      if (savedCompleted) {
        completed = JSON.parse(savedCompleted);
      }

      let depth: TourDepth = savedDepth === 'technical' ? 'technical' : 'simple';

      if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.isRunning && session.activeChapterId) {
          setState({
            activeChapterId: session.activeChapterId,
            activeStepIndex: session.activeStepIndex || 0,
            isRunning: true,
            depth,
            completedChapters: completed,
          });
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        depth,
        completedChapters: completed,
      }));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Sync state to storage
  const persistState = useCallback((newState: TourState) => {
    try {
      if (newState.isRunning && newState.activeChapterId) {
        sessionStorage.setItem(
          STORAGE_KEY_STATE,
          JSON.stringify({
            activeChapterId: newState.activeChapterId,
            activeStepIndex: newState.activeStepIndex,
            isRunning: true,
          })
        );
      } else {
        sessionStorage.removeItem(STORAGE_KEY_STATE);
      }

      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(newState.completedChapters));
      localStorage.setItem(STORAGE_KEY_DEPTH, newState.depth);
    } catch {
      // Ignore
    }
  }, []);

  const currentChapter = useMemo<TourChapter | null>(() => {
    if (!state.activeChapterId) return null;
    return CHAPTERS.find((c) => c.id === state.activeChapterId) || null;
  }, [state.activeChapterId]);

  const currentStep = useMemo<TourStep | null>(() => {
    if (!currentChapter) return null;
    return currentChapter.steps[state.activeStepIndex] || null;
  }, [currentChapter, state.activeStepIndex]);

  const totalStepsInChapter = currentChapter ? currentChapter.steps.length : 0;

  // Resolve target element whenever current step changes
  useEffect(() => {
    if (!state.isRunning || !currentStep) {
      setTargetElement(null);
      return;
    }

    const findTarget = () => {
      if (!currentStep.targetSelector) {
        setTargetElement(null);
        return;
      }
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        setTargetElement(el);
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // Ignore
        }
      } else {
        setTargetElement(null);
        console.warn(`[Walkthrough] Target not found: ${currentStep.targetSelector}`);
      }
    };

    findTarget();
    const timer = setTimeout(findTarget, 250);
    return () => clearTimeout(timer);
  }, [state.isRunning, currentStep, pathname]);

  // Execute step actions on enter
  useEffect(() => {
    if (!state.isRunning || !currentStep || !currentStep.actionId) return;

    const actionId = currentStep.actionId;
    executeTourAction(actionId, { route: pathname });

    return () => {
      undoTourAction(actionId, { route: pathname });
    };
  }, [state.isRunning, currentStep, pathname]);

  const startTour = useCallback(
    (chapterId?: string, stepIndex: number = 0) => {
      const targetChapId = chapterId || CHAPTERS[0].id;
      const chap = CHAPTERS.find((c) => c.id === targetChapId);
      if (!chap) return;

      const nextState: TourState = {
        ...state,
        activeChapterId: targetChapId,
        activeStepIndex: Math.max(0, Math.min(stepIndex, chap.steps.length - 1)),
        isRunning: true,
      };

      setState(nextState);
      persistState(nextState);

      // Navigate if route differs
      if (pathname !== chap.route) {
        router.push(chap.route);
      }
    },
    [state, pathname, router, persistState]
  );

  const goToStep = useCallback(
    (stepIndex: number) => {
      if (!currentChapter) return;
      const boundedIndex = Math.max(0, Math.min(stepIndex, currentChapter.steps.length - 1));
      const nextState: TourState = {
        ...state,
        activeStepIndex: boundedIndex,
      };
      setState(nextState);
      persistState(nextState);
    },
    [state, currentChapter, persistState]
  );

  const markChapterCompleted = useCallback(
    (chapId: string) => {
      if (!state.completedChapters.includes(chapId)) {
        const nextCompleted = [...state.completedChapters, chapId];
        const nextState = { ...state, completedChapters: nextCompleted };
        setState(nextState);
        persistState(nextState);
      }
    },
    [state, persistState]
  );

  const nextStep = useCallback(() => {
    if (!currentChapter) return;
    if (state.activeStepIndex < currentChapter.steps.length - 1) {
      goToStep(state.activeStepIndex + 1);
    } else {
      // Completed chapter
      markChapterCompleted(currentChapter.id);
    }
  }, [currentChapter, state.activeStepIndex, goToStep, markChapterCompleted]);

  const prevStep = useCallback(() => {
    if (state.activeStepIndex > 0) {
      goToStep(state.activeStepIndex - 1);
    }
  }, [state.activeStepIndex, goToStep]);

  const skipChapter = useCallback(() => {
    if (!currentChapter) return;
    markChapterCompleted(currentChapter.id);

    // Find next chapter
    const currentIdx = CHAPTERS.findIndex((c) => c.id === currentChapter.id);
    if (currentIdx >= 0 && currentIdx < CHAPTERS.length - 1) {
      const nextChap = CHAPTERS[currentIdx + 1];
      startTour(nextChap.id, 0);
    } else {
      // Exit and return to hub
      exitTour();
      router.push('/walkthrough');
    }
  }, [currentChapter, markChapterCompleted, startTour, router]);

  const exitTour = useCallback(() => {
    const nextState: TourState = {
      ...state,
      activeChapterId: null,
      activeStepIndex: 0,
      isRunning: false,
    };
    setState(nextState);
    persistState(nextState);
    restoreTourSandbox();
  }, [state, persistState]);

  const restartTour = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEY_STATE);
    } catch {
      // Ignore
    }
    const nextState: TourState = {
      activeChapterId: CHAPTERS[0].id,
      activeStepIndex: 0,
      isRunning: true,
      depth: 'simple',
      completedChapters: [],
    };
    setState(nextState);
    persistState(nextState);
    restoreTourSandbox();
    if (pathname !== CHAPTERS[0].route) {
      router.push(CHAPTERS[0].route);
    }
  }, [pathname, router, persistState]);

  const nextChapter = useCallback(() => {
    if (!currentChapter) return;
    markChapterCompleted(currentChapter.id);

    const currentIdx = CHAPTERS.findIndex((c) => c.id === currentChapter.id);
    if (currentIdx >= 0 && currentIdx < CHAPTERS.length - 1) {
      const nextChap = CHAPTERS[currentIdx + 1];
      startTour(nextChap.id, 0);
    } else {
      exitTour();
      router.push('/walkthrough');
    }
  }, [currentChapter, markChapterCompleted, startTour, exitTour, router]);

  const backToHub = useCallback(() => {
    if (currentChapter) {
      markChapterCompleted(currentChapter.id);
    }
    exitTour();
    router.push('/walkthrough');
  }, [currentChapter, markChapterCompleted, exitTour, router]);

  const setDepth = useCallback(
    (depth: TourDepth) => {
      const nextState: TourState = { ...state, depth };
      setState(nextState);
      persistState(nextState);
    },
    [state, persistState]
  );

  const resolveTextWithCache = useCallback(
    (raw: string) => {
      return resolveTokens(raw, tokens);
    },
    [tokens]
  );

  // Expose window.__urjasetu.test.tour test hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const g = window as any;
      g.__urjasetu = g.__urjasetu || {};
      g.__urjasetu.test = g.__urjasetu.test || {};

      g.__urjasetu.test.tour = {
        getState: () => ({ ...state }),
        goTo: (chapterId: string, stepIndex: number) => {
          startTour(chapterId, stepIndex);
        },
        listMissingTargets: () => {
          const missing: Array<{ chapterId: string; stepId: string; selector: string }> = [];
          CHAPTERS.forEach((ch) => {
            ch.steps.forEach((st) => {
              if (st.targetSelector && !document.querySelector(st.targetSelector)) {
                missing.push({
                  chapterId: ch.id,
                  stepId: st.id,
                  selector: st.targetSelector,
                });
              }
            });
          });
          return missing;
        },
      };
    }
  }, [state, startTour]);

  const contextValue: TourContextValue = useMemo(
    () => ({
      state,
      currentChapter,
      currentStep,
      totalStepsInChapter,
      startTour,
      nextStep,
      prevStep,
      goToStep,
      skipChapter,
      exitTour,
      restartTour,
      setDepth,
      resolveText: resolveTextWithCache,
    }),
    [
      state,
      currentChapter,
      currentStep,
      totalStepsInChapter,
      startTour,
      nextStep,
      prevStep,
      goToStep,
      skipChapter,
      exitTour,
      restartTour,
      setDepth,
      resolveTextWithCache,
    ]
  );

  const hasNextChapter = useMemo(() => {
    if (!currentChapter) return false;
    const idx = CHAPTERS.findIndex((c) => c.id === currentChapter.id);
    return idx >= 0 && idx < CHAPTERS.length - 1;
  }, [currentChapter]);

  return (
    <TourContext.Provider value={contextValue}>
      {children}

      {/* Render Spotlight and Step Card when active */}
      {state.isRunning && currentChapter && currentStep && (
        <>
          <SpotlightOverlay
            targetElement={targetElement}
            onClose={exitTour}
          />
          <StepCard
            step={currentStep}
            chapter={currentChapter}
            stepIndex={state.activeStepIndex}
            totalSteps={totalStepsInChapter}
            depth={state.depth}
            targetElement={targetElement}
            hasNextChapter={hasNextChapter}
            onNext={nextStep}
            onPrev={prevStep}
            onSkipChapter={skipChapter}
            onExit={exitTour}
            onNextChapter={nextChapter}
            onBackToHub={backToHub}
            onSetDepth={setDepth}
            resolveText={resolveTextWithCache}
          />
        </>
      )}
    </TourContext.Provider>
  );
};

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}

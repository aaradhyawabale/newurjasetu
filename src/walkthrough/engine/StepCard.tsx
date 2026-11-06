"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TourStep, TourChapter, TourDepth } from '../types';
import { TruthChip } from '@/components/ui/TruthChip';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface StepCardProps {
  step: TourStep;
  chapter: TourChapter;
  stepIndex: number;
  totalSteps: number;
  depth: TourDepth;
  targetElement: HTMLElement | null;
  hasNextChapter: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkipChapter: () => void;
  onExit: () => void;
  onNextChapter: () => void;
  onBackToHub: () => void;
  onSetDepth: (depth: TourDepth) => void;
  resolveText: (raw: string) => string;
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  chapter,
  stepIndex,
  totalSteps,
  depth,
  targetElement,
  hasNextChapter,
  onNext,
  onPrev,
  onSkipChapter,
  onExit,
  onNextChapter,
  onBackToHub,
  onSetDepth,
  resolveText,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});
  const isLastStep = stepIndex === totalSteps - 1;

  // Collision-aware position calculation
  const calculatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Mobile bottom sheet layout
      setPositionStyle({
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        right: '12px',
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 60,
      });
      return;
    }

    if (!targetElement) {
      // Fallback: Centered card
      setPositionStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 60,
        width: '360px',
      });
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const cardWidth = 360;
    const cardHeight = 320;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    // Prefer placement specified or fallback logically
    const preferred = step.placement || 'auto';

    if (preferred === 'right' && targetRect.right + cardWidth + margin < viewportWidth) {
      left = targetRect.right + margin;
      top = Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
    } else if (preferred === 'left' && targetRect.left - cardWidth - margin > 0) {
      left = targetRect.left - cardWidth - margin;
      top = Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
    } else if (preferred === 'bottom' && targetRect.bottom + cardHeight + margin < viewportHeight) {
      top = targetRect.bottom + margin;
      left = Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin));
    } else if (preferred === 'top' && targetRect.top - cardHeight - margin > 0) {
      top = targetRect.top - cardHeight - margin;
      left = Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin));
    } else {
      // Auto-placement finding maximum available space
      const spaceBelow = viewportHeight - targetRect.bottom;
      const spaceAbove = targetRect.top;
      const spaceRight = viewportWidth - targetRect.right;
      const spaceLeft = targetRect.left;

      if (spaceBelow >= cardHeight + margin) {
        top = targetRect.bottom + margin;
        left = Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin));
      } else if (spaceAbove >= cardHeight + margin) {
        top = targetRect.top - cardHeight - margin;
        left = Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin));
      } else if (spaceRight >= cardWidth + margin) {
        left = targetRect.right + margin;
        top = Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
      } else if (spaceLeft >= cardWidth + margin) {
        left = targetRect.left - cardWidth - margin;
        top = Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
      } else {
        // Fallback to bottom-right or center
        top = Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin));
        left = Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin));
      }
    }

    setPositionStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 60,
    });
  }, [targetElement, step.placement]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [calculatePosition]);

  // Keyboard navigation & accessibility focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key === 'ArrowRight') {
        if (!isLastStep) {
          e.preventDefault();
          onNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (stepIndex > 0) {
          e.preventDefault();
          onPrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus the card container
    if (cardRef.current) {
      cardRef.current.focus();
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLastStep, stepIndex, onNext, onPrev, onExit]);

  const rawBodyText = depth === 'simple' ? step.copy.simple : step.copy.technical;
  const resolvedBodyText = resolveText(rawBodyText);
  const resolvedTitle = resolveText(step.copy.title);

  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-body"
      style={positionStyle}
      className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 focus:outline-none transition-all duration-200"
    >
      {/* Top Header: Chapter & Step Indicator + Exit */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass className="w-4 h-4 text-[#0F5C63] shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">
            {chapter.title}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        <button
          onClick={onExit}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Exit tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden" aria-hidden="true">
        <div
          className="bg-[#0F5C63] h-full transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Depth Toggle: Simple / Technical detail */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600">
          <button
            onClick={() => onSetDepth('simple')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              depth === 'simple'
                ? 'bg-white text-[#0F5C63] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => onSetDepth('technical')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              depth === 'technical'
                ? 'bg-white text-[#0F5C63] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Technical detail
          </button>
        </div>

        {step.copy.chip && (
          <TruthChip
            type={step.copy.chip}
            label={step.copy.chipLabel || step.copy.chip}
            compact
          />
        )}
      </div>

      {/* Step Title & Resolved Body Text */}
      <div className="space-y-1.5" aria-live="polite">
        <h3
          id="tour-step-title"
          className="text-sm sm:text-base font-bold text-[#14212B] leading-tight"
        >
          {resolvedTitle}
        </h3>
        <p
          id="tour-step-body"
          className="text-xs sm:text-sm text-slate-600 leading-relaxed"
        >
          {resolvedBodyText}
        </p>
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={onSkipChapter}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          Skip chapter
        </button>

        <div className="flex items-center gap-1.5">
          {stepIndex > 0 && (
            <button
              onClick={onPrev}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              aria-label="Previous step"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}

          {!isLastStep ? (
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F5C63] hover:bg-[#0A3E43] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              aria-label="Next step"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : hasNextChapter ? (
            <button
              onClick={onNextChapter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5C63] hover:bg-[#0A3E43] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <span>Next chapter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <span>Back to hub</span>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

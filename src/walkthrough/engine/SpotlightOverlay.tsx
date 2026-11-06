"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';

interface SpotlightOverlayProps {
  targetElement: HTMLElement | null;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  targetElement,
  onClose,
}) => {
  const [rect, setRect] = useState<TargetRect | null>(null);

  const updateRect = useCallback(() => {
    if (!targetElement) {
      setRect(null);
      return;
    }
    const r = targetElement.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [targetElement]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('scroll', updateRect, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && targetElement) {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(targetElement);
    }

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [targetElement, updateRect]);

  const padding = 6;
  const radius = 10;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none transition-opacity duration-200"
      aria-hidden="true"
    >
      <svg
        className="w-full h-full pointer-events-auto"
        onClick={onClose}
        style={{ cursor: 'pointer' }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White base fills entire screen */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cutout reveals the target element */}
            {rect && (
              <rect
                x={Math.max(0, rect.left - padding)}
                y={Math.max(0, rect.top - padding)}
                width={rect.width + padding * 2}
                height={rect.height + padding * 2}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* 55% Ink Scrim */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(20, 33, 43, 0.55)"
          mask="url(#spotlight-mask)"
        />
      </svg>
    </div>
  );
};

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIdleRipples } from '../hooks/useIdleRipples';

export function InkBackground() {
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const rippleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Activate organic ambient idle ripples across empty areas of the screen
  useIdleRipples(rippleContainerRef);

  // Pause background animations when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Imperative click ripple listener (user clicks take precedence over idle ripples)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Respect prefers-reduced-motion
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      // Don't spawn ripples if clicking interactive form inputs directly
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const container = rippleContainerRef.current;
      if (!container) return;

      // Enforce max 6 total concurrent ripples
      // Click ripples always win: if cap reached, retire the oldest idle ripple with a smooth quick fade
      while (container.children.length >= 6) {
        const oldestIdle = container.querySelector('.idle-ripple-wrapper') as HTMLElement | null;
        if (oldestIdle) {
          oldestIdle.style.transition = 'opacity 200ms ease-out';
          oldestIdle.style.opacity = '0';
          setTimeout(() => oldestIdle.remove(), 210);
          break;
        } else {
          container.firstElementChild?.remove();
        }
      }

      // Timing calculations: baseline is idle ripple duration (~4200ms)
      // Click ripples run at ~70-80% of idle -> ~2800-3400ms (never below 2500ms)
      const variation = Math.random() * 0.16 - 0.08; // +/- 8%
      const duration = Math.max(2500, Math.round(3000 * (1 + variation)));

      // Size: single ring base diameter D (~260-320px)
      const D = Math.round(290 + (Math.random() * 40 - 20)); // ~270-310px
      const halfD = D / 2;

      // Outer wrapper: anchor point precisely at viewport click coordinates (no transform)
      const wrapper = document.createElement('div');
      wrapper.className = 'click-ripple-wrapper absolute pointer-events-none';
      wrapper.style.left = `${e.clientX}px`;
      wrapper.style.top = `${e.clientY}px`;
      wrapper.style.width = '0px';
      wrapper.style.height = '0px';
      wrapper.style.overflow = 'visible';

      // Single Click Ring: centered via negative margins, scales 0 -> 1.0
      const ring = document.createElement('div');
      ring.className =
        'absolute rounded-full border border-ink-indigo pointer-events-none animate-ink-ripple-1';
      ring.style.left = '0px';
      ring.style.top = '0px';
      ring.style.width = `${D}px`;
      ring.style.height = `${D}px`;
      ring.style.margin = `-${halfD}px 0 0 -${halfD}px`;
      ring.style.transformOrigin = '50% 50%';
      ring.style.boxSizing = 'border-box';
      ring.style.overflow = 'visible';
      ring.style.setProperty('--ripple-duration', `${duration}ms`);

      let removed = false;
      const cleanup = () => {
        if (!removed) {
          removed = true;
          wrapper.remove();
        }
      };

      // Remove strictly on animationend of the single ripple ring
      ring.addEventListener('animationend', cleanup);
      // Hard safety timeout in case animation was canceled or tab hidden
      setTimeout(cleanup, duration + 400);

      wrapper.appendChild(ring);
      container.appendChild(wrapper);
    };

    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <>
      {/* Background pigments, gradients, and noise film (fixed at -z-50 behind all content) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-50 overflow-hidden bg-water-deep select-none"
      >
        {/* Deep water base vertical gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b14] via-[#05070C] to-[#040508] dark:block hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAFBFD] via-[#F4F6F9] to-[#E9EEF5] dark:hidden block" />

        {/* Darkened off-center ink pigment blob in top-right (scaled down on mobile for high FPS) */}
        {isTabVisible && (
          <div
            className="absolute -top-16 -right-16 h-[200px] w-[200px] sm:h-[280px] sm:w-[280px] md:h-[400px] md:w-[400px] max-w-[40vw] max-h-[40vh] rounded-full opacity-18 blur-[60px] md:blur-[110px] pointer-events-none animate-ink-drift"
            style={{
              background:
                'radial-gradient(circle at 45% 45%, #1B1B4B 0%, #0F3B44 55%, rgba(5,7,12,0) 80%)',
              animationDuration: '60s',
            }}
          />
        )}

        {/* Secondary deep wine wash in bottom-left (hidden below 768px to reduce mobile GPU fill-rate) */}
        {isTabVisible && (
          <div
            className="hidden md:block absolute -bottom-20 -left-20 h-[340px] w-[340px] max-w-[35vw] max-h-[35vh] rounded-full opacity-12 blur-[100px] pointer-events-none animate-ink-drift"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, #2B1224 0%, #15152A 60%, rgba(5,7,12,0) 85%)',
              animationDuration: '75s',
              animationDirection: 'reverse',
            }}
          />
        )}

        {/* Scrim / Vignette layer above blobs for guaranteed WCAG AA text contrast */}
        <div
          className="absolute inset-0 pointer-events-none dark:block hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, transparent 20%, rgba(5,7,12,0.85) 90%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none dark:hidden block"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, transparent 30%, rgba(248,249,250,0.80) 90%)',
          }}
        />

        {/* Very subtle paper-grain / noise texture (<= 3%) */}
        <div className="ink-film-grain absolute inset-0 mix-blend-overlay pointer-events-none" />
      </div>

      {/* Full-viewport unclipped ripple layer portaled directly into document.body */}
      {mounted &&
        createPortal(
          <div
            ref={rippleContainerRef}
            id="ink-ripple-layer"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 overflow-visible select-none z-[45]"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100dvh',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          />,
          document.body
        )}
    </>
  );
}

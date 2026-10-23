'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSettings } from '../hooks/useSettings';
import { PAGE_GLOW_ENABLED, PAGE_GLOW_IN_ROOM } from '../theme/tokens';

export function PageCursorGlow() {
  const pathname = usePathname();
  const { cursorGlowEnabled, lowEffectsMode } = useSettings();
  const [mounted, setMounted] = useState(false);
  const glowRef = useRef<HTMLDivElement | null>(null);

  const isRoom = Boolean(pathname?.startsWith('/room/'));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        const id = (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
          setMounted(true);
        });
        return () => {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
        };
      } else {
        const timer = setTimeout(() => setMounted(true), 150);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted || !PAGE_GLOW_ENABLED || !cursorGlowEnabled || lowEffectsMode) {
      return;
    }

    // Completely disable on touch / coarse devices, low concurrency (<=4), and reduced motion
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isLowConcurrency = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 2;
    if (isTouch || isReducedMotion || isLowConcurrency) {
      return;
    }

    // Room visibility check
    if (isRoom && !PAGE_GLOW_IN_ROOM) {
      return;
    }

    const roomMultiplier = isRoom && PAGE_GLOW_IN_ROOM ? 0.5 : 1.0;

    // Movement & state variables (outside React render loop)
    let targetX = -1000;
    let targetY = -1000;
    let currentX = -1000;
    let currentY = -1000;

    let isPointerInside = false;
    let isIdle = false;
    let isOverCard = false;
    let isOverInteractive = false;
    let isModalOpen = false;

    let currentOpacity = 0;
    let rafId: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      isIdle = false;
      idleTimer = setTimeout(() => {
        isIdle = true;
        startRaf();
      }, 4000);
    };

    const getTargetOpacity = (): number => {
      if (!isPointerInside || document.hidden) return 0;

      // Base active level
      let alpha = 1.0;

      // Idle dimming (gently dims to ~40% after ~4s)
      if (isIdle) {
        alpha *= 0.4;
      }

      // Card hover dimming (~30% so card's own glow remains dominant)
      if (isOverCard) {
        alpha *= 0.3;
      } else if (isOverInteractive) {
        // Interactive element slight dimming (~60%)
        alpha *= 0.6;
      }

      // Modal open dimming (~30%)
      if (isModalOpen) {
        alpha *= 0.3;
      }

      // Room multiplier (half opacity if room enabled)
      alpha *= roomMultiplier;

      return alpha;
    };

    const loop = () => {
      if (!glowRef.current) {
        rafId = null;
        return;
      }

      const targetOpacity = getTargetOpacity();

      // Smooth lag interpolation (lerp factor 0.15)
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      currentX += dx * 0.15;
      currentY += dy * 0.15;

      // Opacity lerp: smooth fade out (600ms -> factor 0.06) when leaving, faster (200ms -> 0.15) on hover transitions
      const opacityFactor = targetOpacity === 0 ? 0.06 : 0.15;
      const dOpacity = targetOpacity - currentOpacity;
      currentOpacity += dOpacity * opacityFactor;

      // Direct DOM update without triggering React reconciliation
      glowRef.current.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      glowRef.current.style.opacity = currentOpacity.toFixed(3);

      // Convergence test: stop rAF loop when idle or hidden and movement/opacity converged
      const hasMoved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
      const hasOpacityDelta = Math.abs(dOpacity) > 0.004;

      if (!hasMoved && !hasOpacityDelta && (!isPointerInside || isIdle)) {
        if (glowRef.current) {
          glowRef.current.style.willChange = 'auto';
        }
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(loop);
    };

    const startRaf = () => {
      if (rafId === null) {
        if (glowRef.current) {
          glowRef.current.style.willChange = 'transform, opacity';
        }
        rafId = requestAnimationFrame(loop);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

      if (!isPointerInside) {
        // Initial entry snap to avoid traveling from -1000px
        isPointerInside = true;
        currentX = e.clientX;
        currentY = e.clientY;
      }

      targetX = e.clientX;
      targetY = e.clientY;
      resetIdleTimer();
      startRaf();
    };

    const handlePointerOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const card = target.closest('[data-glow-card]');
      const interactive =
        !card &&
        target.closest('button, a, input, textarea, select, [role="button"], [role="switch"]');

      isOverCard = Boolean(card);
      isOverInteractive = Boolean(interactive);
      isModalOpen =
        document.body.style.overflow === 'hidden' ||
        Boolean(document.querySelector('[role="dialog"]'));

      startRaf();
    };

    const handleMouseLeave = () => {
      isPointerInside = false;
      if (idleTimer) clearTimeout(idleTimer);
      startRaf();
    };

    const handleMouseEnter = (e: MouseEvent) => {
      isPointerInside = true;
      targetX = e.clientX;
      targetY = e.clientY;
      currentX = e.clientX;
      currentY = e.clientY;
      resetIdleTimer();
      startRaf();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (isPointerInside) {
        resetIdleTimer();
        startRaf();
      }
    };

    // Passive listeners on window for maximum performance
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerover', handlePointerOver, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerover', handlePointerOver);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimer) clearTimeout(idleTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [mounted, isRoom, cursorGlowEnabled, lowEffectsMode]);

  if (!mounted || !PAGE_GLOW_ENABLED || !cursorGlowEnabled || lowEffectsMode) {
    return null;
  }

  if (isRoom && !PAGE_GLOW_IN_ROOM) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="page-cursor-glow-container pointer-events-none fixed inset-0 overflow-hidden select-none z-[1]"
    >
      <div
        ref={glowRef}
        className="pointer-events-none absolute top-0 left-0 will-change-transform"
        style={{
          transform: 'translate3d(-1000px, -1000px, 0)',
          opacity: 0,
          willChange: 'transform, opacity',
        }}
      >
        {/* Negative-margin centered radial water-light glow */}
        <div className="page-cursor-glow-blob pointer-events-none" />
      </div>
    </div>
  );
}

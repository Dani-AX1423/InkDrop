'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSettings } from './useSettings';

export const IDLE_RIPPLES_ENABLED = true;

export interface IdleRippleRouteConfig {
  enabled: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  maxConcurrent: number;
  minDurationMs: number;
  maxDurationMs: number;
  minSizePx: number;
  maxSizePx: number;
  minOpacity: number;
  maxOpacity: number;
  edgeMarginPx: number;
  minSeparationPx: number;
}

export const ROUTE_RIPPLE_CONFIGS: Record<string, IdleRippleRouteConfig> = {
  // Lobby Hub: calm, organic raindrops across empty areas
  lobby: {
    enabled: true,
    minIntervalMs: 2500,
    maxIntervalMs: 6000,
    maxConcurrent: 3,
    minDurationMs: 3500,
    maxDurationMs: 5500,
    minSizePx: 240,
    maxSizePx: 420,
    minOpacity: 0.10,
    maxOpacity: 0.22,
    edgeMarginPx: 80,
    minSeparationPx: 200,
  },
  // Chat Room: disabled by default, ready for 1-ripple gentle ambience if enabled
  room: {
    enabled: false,
    minIntervalMs: 6000,
    maxIntervalMs: 12000,
    maxConcurrent: 1,
    minDurationMs: 4000,
    maxDurationMs: 6000,
    minSizePx: 220,
    maxSizePx: 340,
    minOpacity: 0.06,
    maxOpacity: 0.14,
    edgeMarginPx: 100,
    minSeparationPx: 250,
  },
};

interface RecentPoint {
  x: number;
  y: number;
  time: number;
}

export function useIdleRipples(containerRef: React.RefObject<HTMLDivElement | null>) {
  const pathname = usePathname();
  const { lowEffectsMode } = useSettings();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recentPointsRef = useRef<RecentPoint[]>([]);

  useEffect(() => {
    if (!IDLE_RIPPLES_ENABLED || typeof window === 'undefined' || lowEffectsMode) return;

    // Check prefers-reduced-motion or low power
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    // Disable idle background ripples on small touchscreens (<640px) or low hardware concurrency to preserve battery & high FPS
    const isTouchSmallScreen =
      window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 640;
    const isLowPower = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
    if (isTouchSmallScreen || isLowPower) return;

    // Determine config based on active route
    const isLobby = pathname === '/' || pathname === '';
    const config = isLobby ? ROUTE_RIPPLE_CONFIGS.lobby : ROUTE_RIPPLE_CONFIGS.room;

    if (!config || !config.enabled) {
      return;
    }

    let isDisposed = false;

    // Helper: Collect current exclusion rectangles (header, primary CTA, alias editor)
    const getExclusions = (): DOMRect[] => {
      const rects: DOMRect[] = [];
      const header = document.querySelector('header');
      if (header) rects.push(header.getBoundingClientRect());

      const excludedElements = document.querySelectorAll('[data-idle-exclude]');
      excludedElements.forEach((el) => {
        rects.push(el.getBoundingClientRect());
      });

      return rects;
    };

    // Helper: Pick a random candidate position respecting boundaries and exclusions
    const pickPosition = (config: IdleRippleRouteConfig): { x: number; y: number } | null => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const minX = config.edgeMarginPx;
      const maxX = Math.max(minX + 50, vw - config.edgeMarginPx);
      const minY = config.edgeMarginPx + 60; // Extra clearance below header
      const maxY = Math.max(minY + 50, vh - config.edgeMarginPx);

      const exclusions = getExclusions();
      const now = Date.now();
      // Retain only points from last 6 seconds
      recentPointsRef.current = recentPointsRef.current.filter((p) => now - p.time < 6000);

      let bestCandidate: { x: number; y: number } | null = null;
      let maxDistToExclusions = -1;

      // Try up to 16 attempts with biased weighting toward open regions (65% right half, 35% left half)
      for (let attempt = 0; attempt < 16; attempt++) {
        let candidateX: number;
        if (Math.random() < 0.65) {
          // Right half / low-traffic side
          const rightStart = minX + (maxX - minX) * 0.45;
          candidateX = rightStart + Math.random() * (maxX - rightStart);
        } else {
          // Left gaps
          candidateX = minX + Math.random() * (maxX - minX) * 0.45;
        }

        const candidateY = minY + Math.random() * (maxY - minY);

        // Check exclusions with safe padding
        let insideExclusion = false;
        const pad = 35;
        for (const rect of exclusions) {
          if (
            candidateX >= rect.left - pad &&
            candidateX <= rect.right + pad &&
            candidateY >= rect.top - pad &&
            candidateY <= rect.bottom + pad
          ) {
            insideExclusion = true;
            break;
          }
        }
        if (insideExclusion) continue;

        // Check distance against recently spawned points
        let tooClose = false;
        for (const pt of recentPointsRef.current) {
          const dx = candidateX - pt.x;
          const dy = candidateY - pt.y;
          if (dx * dx + dy * dy < config.minSeparationPx * config.minSeparationPx) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Valid candidate found!
        bestCandidate = { x: Math.round(candidateX), y: Math.round(candidateY) };
        break;
      }

      return bestCandidate;
    };

    // Spawns one ambient idle ripple into the shared container
    const spawnIdleRipple = () => {
      if (isDisposed || document.hidden) return;

      const container = containerRef.current;
      if (!container) return;

      // Check current active idle ripples ceiling
      const activeIdleElements = container.querySelectorAll('.idle-ripple-wrapper');
      if (activeIdleElements.length >= config.maxConcurrent) {
        scheduleNext();
        return;
      }

      const pos = pickPosition(config);
      if (!pos) {
        scheduleNext();
        return;
      }

      recentPointsRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });

      // Randomized ripple characteristics
      const size = Math.round(config.minSizePx + Math.random() * (config.maxSizePx - config.minSizePx));
      const duration = Math.round(config.minDurationMs + Math.random() * (config.maxDurationMs - config.minDurationMs));
      const peakOpacity = Number((config.minOpacity + Math.random() * (config.maxOpacity - config.minOpacity)).toFixed(3));
      const stagger = Math.round(260 + Math.random() * 120);
      const ringCount = Math.random() > 0.4 ? 3 : 2;

      // Palette selection: 55% indigo, 35% teal, 10% faint rose
      const colorRoll = Math.random();
      const color = colorRoll < 0.55 ? '#5B5BFF' : colorRoll < 0.90 ? '#2DD4BF' : '#FF4D8D';

      // Wrapper element positioned statically via left/top (dimensionless, unclipped)
      const wrapper = document.createElement('div');
      wrapper.className = 'idle-ripple-wrapper absolute pointer-events-none';
      wrapper.style.left = `${pos.x}px`;
      wrapper.style.top = `${pos.y}px`;
      wrapper.style.width = '0px';
      wrapper.style.height = '0px';
      wrapper.style.overflow = 'visible';

      // Center drop dot (~3.5px, centered via negative margin, fades out over ~300ms)
      const dot = document.createElement('div');
      dot.className = 'absolute rounded-full pointer-events-none animate-idle-drop-dot';
      dot.style.left = '0px';
      dot.style.top = '0px';
      dot.style.width = '3.5px';
      dot.style.height = '3.5px';
      dot.style.margin = '-1.75px 0 0 -1.75px';
      dot.style.transformOrigin = '50% 50%';
      dot.style.boxSizing = 'border-box';
      dot.style.backgroundColor = color;
      wrapper.appendChild(dot);

      // Concentric rings centered via negative margin (concentric by construction)
      const halfSize = size / 2;
      for (let i = 0; i < ringCount; i++) {
        const ring = document.createElement('div');
        ring.className = 'absolute rounded-full pointer-events-none animate-ambient-ripple';
        ring.style.left = '0px';
        ring.style.top = '0px';
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.margin = `-${halfSize}px 0 0 -${halfSize}px`;
        ring.style.transformOrigin = '50% 50%';
        ring.style.boxSizing = 'border-box';
        ring.style.borderColor = color;
        ring.style.borderStyle = 'solid';
        ring.style.overflow = 'visible';
        ring.style.setProperty('--ripple-duration', `${duration}ms`);
        ring.style.setProperty('--ripple-delay', `${i * stagger}ms`);

        const ringOpacity = i === 0 ? peakOpacity : i === 1 ? peakOpacity * 0.75 : peakOpacity * 0.5;
        ring.style.setProperty('--peak-opacity', ringOpacity.toFixed(3));

        if (i === ringCount - 1) {
          // Last ring cleanup trigger
          ring.addEventListener('animationend', () => {
            wrapper.remove();
          });
        }

        wrapper.appendChild(ring);
      }

      // Hard safety timeout
      setTimeout(() => {
        wrapper.remove();
      }, duration + ringCount * stagger + 300);

      container.appendChild(wrapper);
      scheduleNext();
    };

    const scheduleNext = () => {
      if (isDisposed) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      const nextInterval = Math.round(
        config.minIntervalMs + Math.random() * (config.maxIntervalMs - config.minIntervalMs)
      );

      timerRef.current = setTimeout(spawnIdleRipple, nextInterval);
    };

    // Tab visibility handling: pause when hidden, resume single timer when returning
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // Resume after short calm delay (no burst of queued spawns)
        scheduleNext();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial spawn scheduled after brief warm-up
    scheduleNext();

    const currentContainer = containerRef.current;

    return () => {
      isDisposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Remove any active idle ripple wrappers on unmount/route-change
      if (currentContainer) {
        const wrappers = currentContainer.querySelectorAll('.idle-ripple-wrapper');
        wrappers.forEach((w) => w.remove());
      }
    };
  }, [pathname, containerRef, lowEffectsMode]);
}

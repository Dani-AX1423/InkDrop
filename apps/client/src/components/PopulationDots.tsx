'use client';

import React from 'react';

interface PopulationDotsProps {
  count: number;
  maxDots?: number;
  className?: string;
}

export function PopulationDots({
  count,
  maxDots = 8,
  className = '',
}: PopulationDotsProps) {
  const safeCount = Math.max(0, count);
  const visibleDots = Math.min(safeCount, maxDots);
  const overflow = safeCount - maxDots;

  if (safeCount === 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono text-paper-muted ${className}`}>
        <span className="h-2 w-2 rounded-full border border-paper-muted/30 bg-paper-muted/10" />
        <span>empty</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} title={`${safeCount} participants in pool`}>
      {/* Individual User Ink Drops / Dots */}
      {Array.from({ length: visibleDots }).map((_, i) => (
        <span key={i} className="relative flex h-2.5 w-2.5 items-center justify-center">
          {i === 0 && (
            <span className="absolute h-full w-full rounded-full bg-ink-teal/40 animate-ping opacity-60" />
          )}
          <span
            className={`h-1.5 w-1.5 rounded-full transition-transform duration-200 ${
              i === 0 ? 'bg-ink-teal scale-110 shadow-[0_0_8px_rgba(45,212,191,0.8)]' : 'bg-ink-teal/70'
            }`}
          />
        </span>
      ))}

      {/* Overflow Count */}
      {overflow > 0 && (
        <span className="font-mono text-[10px] text-paper-muted ml-0.5 font-medium">
          +{overflow}
        </span>
      )}
    </div>
  );
}

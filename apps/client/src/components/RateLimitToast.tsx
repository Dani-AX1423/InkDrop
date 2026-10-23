'use client';

import React from 'react';
import { X, Droplets } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export function RateLimitToast() {
  const { rateLimitNotice, clearRateLimitNotice, rateLimitProgress } = useSocket();

  if (!rateLimitNotice) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[130] max-w-[calc(100vw-32px)] sm:max-w-sm animate-fade-in"
    >
      <div className="relative overflow-hidden rounded-2xl border border-ink-rose/35 bg-surface-elevated/98 p-4 shadow-2xl backdrop-blur-md">
        {/* Soft rose ink bloom */}
        <div
          className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-ink-rose/20 blur-xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-start gap-3">
          <div className="rounded-xl p-2 bg-ink-rose/15 text-ink-rose shrink-0 border border-ink-rose/30">
            <Droplets className="h-4 w-4" strokeWidth={1.5} />
          </div>

          <div className="flex-1 pr-1 min-w-0">
            <h3 className="text-xs font-semibold text-paper-white font-display tracking-tight">
              Slow down, the water needs to settle
            </h3>
            <p className="mt-1 text-[11px] text-paper-muted leading-relaxed">
              {rateLimitNotice.message}
            </p>
            <p className="mt-1 font-mono text-[10px] text-ink-rose font-medium">
              Drying time: {Math.ceil((rateLimitNotice.retryAfterMs * (rateLimitProgress / 100)) / 1000)}s remaining
            </p>
          </div>

          <button
            type="button"
            onClick={clearRateLimitNotice}
            aria-label="Dismiss notice"
            className="rounded-lg p-1 text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-rose"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Ink Drying Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-border">
          <div
            className="h-full bg-gradient-to-r from-ink-rose to-ink-amber transition-[width] ease-linear"
            style={{ width: `${rateLimitProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

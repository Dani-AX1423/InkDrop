'use client';

import React from 'react';
import { X, Droplets } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export function RateLimitToast() {
  const { rateLimitNotice, clearRateLimitNotice, rateLimitProgress } = useSocket();

  if (!rateLimitNotice) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-ink-drop">
      <div className="relative overflow-hidden rounded-[20px] border border-ink-rose/30 bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur-md">
        {/* Soft rose ink bloom */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-ink-rose/20 blur-xl" />

        <div className="relative z-10 flex items-start gap-3">
          <div className="rounded-full p-2 bg-ink-rose/15 text-ink-rose">
            <Droplets className="h-4 w-4" />
          </div>
          <div className="flex-1 pr-1">
            <h4 className="text-xs font-medium text-paper-white font-display tracking-tight">
              Slow down, the water needs to settle
            </h4>
            <p className="mt-1 text-[11px] text-paper-muted leading-snug">
              {rateLimitNotice.message}
            </p>
            <p className="mt-1 text-[10px] font-mono text-ink-rose/80">
              Drying time: {Math.ceil((rateLimitNotice.retryAfterMs * (rateLimitProgress / 100)) / 1000)}s remaining
            </p>
          </div>
          <button
            onClick={clearRateLimitNotice}
            className="rounded-full p-1 text-paper-muted hover:text-paper-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Ink Drying Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-border">
          <div
            className="h-full bg-gradient-to-r from-ink-rose to-ink-amber transition-all ease-linear"
            style={{ width: `${rateLimitProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

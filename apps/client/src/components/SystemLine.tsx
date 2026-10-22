'use client';

import React from 'react';
import { ChatMessage } from '../types';

interface SystemLineProps {
  message: ChatMessage;
}

export function SystemLine({ message }: SystemLineProps) {
  const isEvaporated =
    message.systemType === 'leave' ||
    message.systemType === 'expire' ||
    message.text.toLowerCase().includes('evaporat');

  const isWarning = message.systemType === 'warning';

  return (
    <div className={`my-3.5 flex justify-center ${isEvaporated ? 'animate-ink-vapor' : 'animate-ink-drop'}`}>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-mono border backdrop-blur-sm transition-all ${
          isWarning
            ? 'border-ink-amber/35 bg-ink-amber/15 text-ink-amber'
            : isEvaporated
            ? 'border-ink-rose/25 bg-ink-rose/10 text-ink-rose/90'
            : 'border-ink-teal/25 bg-ink-teal/10 text-ink-teal/90'
        }`}
      >
        {/* Ink drop glyph with animation */}
        <span className="relative flex h-2 w-2 items-center justify-center">
          {!isEvaporated && !isWarning && (
            <span className="absolute h-full w-full rounded-full bg-ink-teal/60 animate-ping opacity-60" />
          )}
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isWarning
                ? 'bg-ink-amber'
                : isEvaporated
                ? 'bg-ink-rose'
                : 'bg-ink-teal shadow-[0_0_6px_rgba(45,212,191,0.8)]'
            }`}
          />
        </span>

        <span>{message.text}</span>
      </div>
    </div>
  );
}

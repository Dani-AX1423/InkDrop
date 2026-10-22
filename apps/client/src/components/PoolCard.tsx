'use client';

import React, { useState, useRef } from 'react';
import { Lock, ArrowRight, Clock } from 'lucide-react';
import { PublicRoomInfo } from '../types';
import { PopulationDots } from './PopulationDots';
import { useSocket } from '../hooks/useSocket';

interface PoolCardProps {
  room: PublicRoomInfo;
  onEnter: (room: PublicRoomInfo) => void;
}

export function PoolCard({ room, onEnter }: PoolCardProps) {
  const { connectionStatus } = useSocket();
  const isConnected = connectionStatus === 'connected';

  const [hovered, setHovered] = useState(false);
  const [ripplePos, setRipplePos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setRipplePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const isLocked = room.isPrivate;

  // Compute remaining minutes if expiresAt is set
  const remainingMinutes = room.expiresAt
    ? Math.max(1, Math.round((room.expiresAt - Date.now()) / (60 * 1000)))
    : null;

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setRipplePos(null);
      }}
      onMouseMove={handleMouseMove}
      onClick={() => {
        if (isConnected) onEnter(room);
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-surface-border bg-surface-base/85 p-5 sm:p-6 backdrop-blur-md transition-all duration-200 shadow-sm min-h-[140px] ${
        isConnected ? 'hover-lift hover:border-surface-border-hover cursor-pointer active:scale-[0.98]' : 'cursor-not-allowed opacity-80'
      }`}
    >
      {/* Corner Bleed: Subtle atmospheric tint */}
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full transition-all duration-500 blur-2xl ${
          isLocked
            ? 'bg-ink-rose/12 group-hover:bg-ink-rose/20'
            : 'bg-ink-indigo/12 group-hover:bg-ink-indigo/20'
        }`}
      />

      {/* Mouse hover ambient ripple highlight */}
      {hovered && ripplePos && isConnected && (
        <div
          className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-xl transition-opacity duration-300"
          style={{
            left: ripplePos.x,
            top: ripplePos.y,
            background: isLocked ? '#FF4D8D' : '#5B5BFF',
          }}
        />
      )}

      {/* Top Header Row */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-paper-white group-hover:text-white transition-colors truncate">
            {room.name}
          </h3>
          <div className="mt-1.5 flex items-center">
            <span className="inline-block -rotate-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-dashed border-surface-border text-paper-muted/80 bg-surface-elevated/40 tracking-wider">
              {room.id}
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {remainingMinutes !== null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-ink-indigo/30 bg-ink-indigo/10 px-2 py-0.5 text-[10px] font-mono text-paper-white">
              <Clock className="h-2.5 w-2.5 text-ink-indigo" strokeWidth={1.5} />
              <span>{remainingMinutes}m</span>
            </span>
          )}

          {isLocked ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-ink-rose/30 bg-ink-rose/10 px-2 py-0.5 text-[10px] font-mono text-ink-rose">
              <Lock className="h-2.5 w-2.5" strokeWidth={1.5} />
              <span>locked</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-ink-teal/30 bg-ink-teal/10 px-2 py-0.5 text-[10px] font-mono text-ink-teal">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-teal" />
              <span>open</span>
            </span>
          )}
        </div>
      </div>

      {/* Bottom Footer Row */}
      <div className="relative z-10 mt-6 flex items-center justify-between border-t border-surface-border pt-4">
        {/* Population as Organic Ink Dots */}
        <div className="flex items-center gap-2">
          <PopulationDots count={room.userCount} />
          <span className="font-body text-xs text-paper-muted">
            {room.userCount} {room.userCount === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* Enter Action Button */}
        <button
          type="button"
          disabled={!isConnected}
          title={!isConnected ? 'Connecting to server...' : 'Enter pool'}
          onClick={(e) => {
            e.stopPropagation();
            if (isConnected) onEnter(room);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-surface-elevated text-paper-white hover:bg-ink-indigo hover:text-white transition-all select-none border border-surface-border hover:border-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Enter</span>
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useRef, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Unlock, ArrowRight, Clock } from 'lucide-react';
import { PublicRoomInfo } from '../types';
import { PopulationDots } from './PopulationDots';
import { Badge } from './ui/Badge';
import { useSocket } from '../hooks/useSocket';

interface PoolCardProps {
  room: PublicRoomInfo;
  onEnter: (room: PublicRoomInfo) => void;
}

export const PoolCard = memo(function PoolCard({ room, onEnter }: PoolCardProps) {
  const router = useRouter();
  const { connectionStatus } = useSocket();
  const isConnected = connectionStatus === 'connected';

  const cardRef = useRef<HTMLDivElement | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      cachedRectRef.current = cardRef.current.getBoundingClientRect();
    }
    router.prefetch(`/room/${room.id}`);
  }, [router, room.id]);

  const handleFocus = useCallback(() => {
    router.prefetch(`/room/${room.id}`);
  }, [router, room.id]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    if (!cachedRectRef.current) {
      cachedRectRef.current = cardRef.current.getBoundingClientRect();
    }
    const rect = cachedRectRef.current;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--card-mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--card-mouse-y', `${y}px`);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && isConnected) {
      e.preventDefault();
      onEnter(room);
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
      role="button"
      tabIndex={isConnected ? 0 : -1}
      data-glow-card="true"
      aria-label={`Enter pool ${room.name}. ${isLocked ? 'Locked with passcode.' : 'Open pool.'} ${room.userCount} occupants.`}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (isConnected) onEnter(room);
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-surface-border bg-surface-base/85 p-5 sm:p-6 backdrop-blur-md transition-colors transition-transform transition-opacity duration-150 shadow-sm min-h-[148px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep ${
        isConnected
          ? 'hover-lift hover:border-surface-border-hover cursor-pointer active:scale-[0.98]'
          : 'cursor-not-allowed opacity-75'
      }`}
    >
      {/* Corner Bleed: Subtle atmospheric tint */}
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full transition-colors transition-opacity duration-300 blur-2xl ${
          isLocked
            ? 'bg-ink-rose/12 group-hover:bg-ink-rose/20'
            : 'bg-ink-indigo/12 group-hover:bg-ink-indigo/20'
        }`}
        aria-hidden="true"
      />

      {/* Mouse hover ambient ripple highlight via CSS vars (zero React re-renders) */}
      {isConnected && (
        <div
          className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-15 blur-xl transition-opacity duration-200"
          style={{
            left: 'var(--card-mouse-x, -999px)',
            top: 'var(--card-mouse-y, -999px)',
            background: isLocked ? '#FF4D8D' : '#5B5BFF',
          }}
          aria-hidden="true"
        />
      )}

      {/* Top Header Row */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-paper-white group-hover:text-ink-indigo transition-colors truncate">
            {room.name}
          </h3>
          <div className="mt-1.5 flex items-center">
            <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border border-dashed border-surface-border text-paper-muted bg-surface-elevated/40 tracking-wider">
              {room.id}
            </span>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {remainingMinutes !== null && (
            <Badge
              variant="indigo"
              size="sm"
              icon={<Clock className="h-3 w-3 text-ink-indigo" strokeWidth={1.5} />}
            >
              {remainingMinutes}m
            </Badge>
          )}

          {isLocked ? (
            <Badge
              variant="rose"
              size="sm"
              icon={<Lock className="h-3 w-3 text-ink-rose" strokeWidth={1.5} />}
            >
              locked
            </Badge>
          ) : (
            <Badge
              variant="teal"
              size="sm"
              icon={<Unlock className="h-3 w-3 text-ink-teal" strokeWidth={1.5} />}
            >
              open
            </Badge>
          )}
        </div>
      </div>

      {/* Bottom Footer Row */}
      <div className="relative z-10 mt-6 flex items-center justify-between border-t border-surface-border pt-4">
        {/* Population as Organic Ink Dots */}
        <div className="flex items-center gap-2">
          <PopulationDots count={room.userCount} />
          <span className="font-body text-xs text-paper-muted select-none">
            {room.userCount} {room.userCount === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* Enter Action Button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={!isConnected}
          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium bg-surface-elevated text-paper-white group-hover:bg-ink-indigo group-hover:text-white transition-colors select-none border border-surface-border group-hover:border-transparent pointer-events-none"
        >
          <span>Enter</span>
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  );
});

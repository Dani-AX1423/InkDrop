'use client';

import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Plus,
  Dices,
  Check,
  X,
  Droplets,
  AlertCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { PoolCard } from '../components/PoolCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { generateRandomAlias } from '../theme/tokens';
import { PublicRoomInfo } from '../types';

// Lazy-load heavy modals with next/dynamic
const CreateRoomModal = dynamic(
  () => import('../components/CreateRoomModal').then((mod) => mod.CreateRoomModal),
  { ssr: false }
);

const PasswordPromptModal = dynamic(
  () => import('../components/PasswordPromptModal').then((mod) => mod.PasswordPromptModal),
  { ssr: false }
);

export default function LobbyHubPage() {
  const router = useRouter();
  const {
    rooms,
    username,
    setUsername,
    requestRoomList,
    joinRoom,
    connectionStatus,
    wakingElapsedSeconds,
    retryConnection,
    evaporatedNotice,
    clearEvaporatedNotice,
  } = useSocket();
  const { toast } = useToast();

  const isConnected = connectionStatus === 'connected';
  const isWaking = connectionStatus === 'waking';
  const isOffline = connectionStatus === 'offline';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState<PublicRoomInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaved, setAliasSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false);

  // First-visit hint localStorage check (non-identifying flag)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('inkdrop_hint_dismissed');
      if (!dismissed) {
        setShowFirstVisitHint(true);
      }
    }
  }, []);

  const handleDismissHint = () => {
    setShowFirstVisitHint(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('inkdrop_hint_dismissed', 'true');
    }
  };

  // Sync alias input when username updates
  useEffect(() => {
    if (username) {
      setAliasInput(username);
    }
  }, [username]);

  // Automated background room list refresh (every 5 seconds)
  useEffect(() => {
    if (isConnected) {
      requestRoomList();
      const interval = setInterval(() => {
        requestRoomList();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, requestRoomList]);

  const handleSaveAlias = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = aliasInput.trim();
    if (trimmed && trimmed !== username) {
      setUsername(trimmed);
      setAliasSaved(true);
      toast.success(`Speaking handle set to "${trimmed}"`);
      setTimeout(() => setAliasSaved(false), 2000);
    }
  };

  const handleShuffleAlias = () => {
    const randomName = generateRandomAlias();
    setAliasInput(randomName);
    setUsername(randomName);
    setAliasSaved(true);
    toast.success(`Generated alias "${randomName}"`);
    setTimeout(() => setAliasSaved(false), 2000);
  };

  const handleRefresh = () => {
    if (!isConnected) return;
    setIsRefreshing(true);
    requestRoomList();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleEnterPool = async (room: PublicRoomInfo) => {
    if (!isConnected) return;
    if (room.isPrivate) {
      setSelectedPrivateRoom(room);
    } else {
      const savedUsername =
        (typeof window !== 'undefined'
          ? localStorage.getItem('inkdrop_username') || localStorage.getItem('inkdrop_alias')
          : null) || username;
      const res = await joinRoom(room.id, undefined, savedUsername);
      if (res.success) {
        router.push(`/room/${room.id}`);
      }
    }
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filter pools list
  const filteredRooms = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [rooms, deferredSearchQuery]);

  const hasAnyPools = rooms.length > 0;

  return (
    <div className="ink-container py-8 sm:py-12 md:py-16">
      {/* Evaporated Notification Banner */}
      {evaporatedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-center justify-between rounded-xl border border-ink-rose/35 bg-ink-rose/10 px-4 py-3 text-xs sm:text-sm text-paper-white shadow-sm animate-fade-in"
        >
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-ink-rose shrink-0" aria-hidden="true" />
            <span>{evaporatedNotice}</span>
          </div>
          <button
            type="button"
            onClick={clearEvaporatedNotice}
            aria-label="Dismiss message"
            className="text-paper-muted hover:text-paper-white p-1 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Two-Column Responsive Layout at >=1024px */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-12 xl:gap-16 lg:items-start">
        {/* Left Column: Hero & Controls */}
        <div className="flex flex-col justify-start">
          <h1 className="font-display text-fluid-hero font-bold tracking-tight text-paper-white text-balance">
            Say it. Then let it <strong className="font-extrabold text-paper-white">evaporate.</strong>
          </h1>

          <p className="mt-4 text-fluid-body text-paper-muted font-body text-pretty max-w-[50ch]">
            No accounts. No logs. Pools live purely in volatile memory and vanish when the last person departs.
          </p>

          {/* Understated Inline Alias Editor */}
          <div className="mt-6 sm:mt-8 p-3.5 sm:p-4 rounded-2xl border border-surface-border bg-surface-base/60 backdrop-blur-sm max-w-md">
            <div className="flex items-center justify-between text-xs text-paper-muted mb-2">
              <span className="font-mono">Speaking as:</span>
              <span className="font-mono text-[10px]">{aliasInput.length} / 24</span>
            </div>

            <form onSubmit={handleSaveAlias} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Choose nickname..."
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                maxLength={24}
                autoComplete="off"
                aria-label="Speaking handle"
                className="flex-1 h-10 rounded-xl border border-surface-border bg-surface-elevated/80 px-3 text-xs sm:text-sm text-paper-white placeholder-paper-faint focus:outline-none focus:ring-2 focus:ring-ink-indigo transition-colors duration-150"
              />

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleShuffleAlias}
                title="Shuffle nickname"
                aria-label="Shuffle nickname"
                className="h-10 px-3 shrink-0"
              >
                <Dices className="h-4 w-4" strokeWidth={1.5} />
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!aliasInput.trim() || aliasInput.trim() === username}
                className="h-10 px-4 text-xs shrink-0"
              >
                {aliasSaved ? (
                  <span className="inline-flex items-center gap-1 text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> Set
                  </span>
                ) : (
                  'Set'
                )}
              </Button>
            </form>
          </div>

          {/* Waking State Banner (Cold-start handling with elapsed seconds) */}
          {isWaking && (
            <div
              className="mt-6 rounded-2xl border border-ink-amber/25 bg-surface-base/80 p-5 sm:p-6 backdrop-blur-md transition-colors transition-transform duration-150 shadow-sm animate-fade-in"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-4">
                <div className="relative flex h-8 w-8 items-center justify-center shrink-0 mt-0.5">
                  <span className="absolute h-8 w-8 rounded-full border border-ink-amber/40 animate-ping opacity-60" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-ink-amber shadow-[0_0_8px_rgba(251,191,36,0.6)]" aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-paper-white">
                      Waking the server…
                    </h2>
                    <span className="font-mono text-xs text-ink-amber">
                      {wakingElapsedSeconds}s elapsed
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-paper-muted font-body leading-relaxed max-w-[50ch]">
                    Free instances sleep during periods of inactivity. This cold start can take up to a minute — the pools will bloom the moment the gateway responds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Offline State Banner (90s Graceful give-up with Retry CTA) */}
          {isOffline && (
            <div
              className="mt-6 rounded-2xl border border-ink-rose/30 bg-surface-base/80 p-5 sm:p-6 backdrop-blur-md transition-colors transition-transform duration-150 shadow-sm animate-fade-in"
              role="alert"
              aria-live="polite"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <span className="h-3 w-3 rounded-full bg-ink-rose shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-paper-white">
                      Server isn&apos;t responding
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-paper-muted font-body leading-relaxed max-w-[48ch]">
                      The gateway hasn&apos;t answered after 90 seconds. It may still be booting or encountering network limits.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={retryConnection}
                  leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={1.5} />}
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {/* Mobile-only CTA button */}
          <div className="mt-6 lg:hidden">
            <Button
              variant="primary"
              size="lg"
              disabled={!isConnected}
              onClick={() => setIsCreateOpen(true)}
              className="w-full h-12 shadow-lg shadow-ink-indigo/20 font-medium"
              leftIcon={<Plus className="h-4 w-4" strokeWidth={1.5} />}
            >
              Create Pool
            </Button>
          </div>
        </div>

        {/* Right Column: Search, Toolbar & Pool Grid */}
        <div className="mt-10 lg:mt-0 w-full">
          {/* Toolbar when pools exist */}
          {hasAnyPools && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-muted"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search pools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  aria-label="Search pools"
                  className="w-full h-11 rounded-xl border border-surface-border bg-surface-base/80 pl-10 pr-4 text-sm text-paper-white placeholder-paper-faint focus:outline-none focus:ring-2 focus:ring-ink-indigo transition-colors duration-150 backdrop-blur-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleRefresh}
                  disabled={!isConnected}
                  title="Refresh pool directory"
                  aria-label="Refresh pool directory"
                  className="h-11 px-3.5"
                  leftIcon={
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-ink-teal' : ''}`}
                      strokeWidth={1.5}
                    />
                  }
                >
                  <span className="hidden sm:inline">Refresh</span>
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  disabled={!isConnected}
                  onClick={() => setIsCreateOpen(true)}
                  className="hidden lg:inline-flex h-11"
                  leftIcon={<Plus className="h-4 w-4" strokeWidth={1.5} />}
                >
                  Create Pool
                </Button>
              </div>
            </div>
          )}

          {/* Skeletons, Empty State, or Active Pool Grid */}
          {isWaking || (connectionStatus === 'connecting' && !hasAnyPools) ? (
            /* Waking Skeleton Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in" role="status" aria-label="Loading pools">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="flex flex-col justify-between rounded-2xl border border-surface-border/50 bg-surface-base/40 p-5 backdrop-blur-sm animate-pulse min-h-[148px]"
                >
                  <div className="space-y-3">
                    <div className="h-5 w-3/4 rounded-lg bg-surface-elevated/80" />
                    <div className="h-3 w-1/3 rounded bg-surface-elevated/50" />
                  </div>
                  <div className="border-t border-surface-border/40 pt-4 flex items-center justify-between">
                    <div className="h-3 w-20 rounded bg-surface-elevated/50" />
                    <div className="h-6 w-14 rounded-lg bg-surface-elevated/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasAnyPools ? (
            /* Empty State */
            <div className="flex flex-col justify-center rounded-3xl border border-surface-border/60 bg-surface-card p-6 sm:p-8 md:p-10 backdrop-blur-md animate-fade-in">
              <div className="relative w-14 h-14 mb-4" aria-hidden="true">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible pointer-events-none">
                  <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-indigo/35 animate-empty-water-1" />
                  <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-teal/25 animate-empty-water-2" />
                  <circle cx="50" cy="50" r="3" className="fill-ink-indigo/70" />
                </svg>
              </div>

              <h2 className="font-display text-fluid-h2 font-bold tracking-tight text-paper-white text-balance leading-[1.15]">
                The water&apos;s still. Drop the first ink.
              </h2>

              <p className="mt-3 text-fluid-body text-paper-muted leading-relaxed font-body text-pretty max-w-[46ch]">
                All previous conversations have evaporated from memory. Create an open pool or lock one with a secret passcode to begin.
              </p>

              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!isConnected}
                  onClick={() => setIsCreateOpen(true)}
                  className="shadow-lg shadow-ink-indigo/20 font-medium"
                  leftIcon={<Plus className="h-4 w-4" strokeWidth={1.5} />}
                >
                  Create Pool
                </Button>
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            /* Search filter with zero results */
            <div className="rounded-2xl border border-surface-border bg-surface-base/60 p-8 text-center animate-fade-in">
              <p className="font-display text-lg text-paper-white font-semibold">
                No pools match &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-xs text-paper-muted mt-1.5">
                Clear the search query or start a new pool with this title.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4 text-ink-teal"
              >
                Clear search
              </Button>
            </div>
          ) : (
            /* Active Pools Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {filteredRooms.map((room) => (
                <PoolCard key={room.id} room={room} onEnter={handleEnterPool} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editorial Micro-Notes (Responsive 3-Column Section) */}
      <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-surface-border pt-10">
        <div>
          <h2 className="font-display text-sm font-semibold text-paper-white mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-indigo" aria-hidden="true" />
            In-flight scrubbing
          </h2>
          <p className="text-xs text-paper-muted leading-relaxed font-body max-w-[40ch]">
            A synchronous Trie filter normalizes obfuscations and masks profanities into equivalent asterisks before WebSocket fan-out.
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold text-paper-white mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-teal" aria-hidden="true" />
            Sliding-window rate limit
          </h2>
          <p className="text-xs text-paper-muted leading-relaxed font-body max-w-[40ch]">
            Bursts are capped to 5 messages per 2-second rolling window. Image transmissions are throttled to 3 per 10 seconds.
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold text-paper-white mb-1.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-rose" aria-hidden="true" />
            Zero-disk architecture
          </h2>
          <p className="text-xs text-paper-muted leading-relaxed font-body max-w-[40ch]">
            The instant the last person departs or a scheduled timer expires, all room state and in-flight images are purged from memory.
          </p>
        </div>
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <PasswordPromptModal
        room={selectedPrivateRoom}
        onClose={() => setSelectedPrivateRoom(null)}
      />

      {/* Floating First-Visit Hint (Zero Layout Shift) */}
      {showFirstVisitHint && (
        <div
          role="complementary"
          aria-label="First-time user guide"
          className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-40 max-w-[calc(100vw-32px)] sm:max-w-sm rounded-2xl border border-ink-indigo/35 bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur-md animate-fade-in flex items-start gap-3"
        >
          <div className="p-2 rounded-xl bg-ink-indigo/15 text-ink-indigo shrink-0 mt-0.5 border border-ink-indigo/30">
            <Droplets className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <h2 className="text-xs font-semibold text-paper-white font-display">
              Volatile pools guide
            </h2>
            <p className="mt-1 text-[11px] text-paper-muted leading-relaxed">
              Pools live entirely in memory. When everyone departs or the timer runs out, everything vanishes forever.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissHint}
            aria-label="Dismiss guide"
            className="text-paper-muted hover:text-paper-white p-1 rounded-lg transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

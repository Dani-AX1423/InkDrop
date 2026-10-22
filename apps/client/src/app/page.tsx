'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Plus,
  Dices,
  Check,
  X,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { PoolCard } from '../components/PoolCard';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { RippleButton } from '../components/RippleButton';
import { generateRandomAlias } from '../theme/tokens';
import { PublicRoomInfo } from '../types';

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

  const isConnected = connectionStatus === 'connected';
  const isWaking = connectionStatus === 'waking';
  const isOffline = connectionStatus === 'offline';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState<PublicRoomInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaved, setAliasSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    if (trimmed) {
      setUsername(trimmed);
      setAliasSaved(true);
      setTimeout(() => setAliasSaved(false), 2000);
    }
  };

  const handleShuffleAlias = () => {
    const randomName = generateRandomAlias();
    setAliasInput(randomName);
    setUsername(randomName);
    setAliasSaved(true);
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

  // Filter pools list
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [rooms, searchQuery]);

  const hasAnyPools = rooms.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Evaporated Notification Banner */}
      {evaporatedNotice && (
        <div
          className="mb-6 flex items-center justify-between rounded-xl border border-ink-rose/35 bg-ink-rose/10 px-4 py-3 text-xs sm:text-sm text-paper-white shadow-sm animate-fade-in"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-ink-rose shrink-0" />
            <span>{evaporatedNotice}</span>
          </div>
          <button
            type="button"
            onClick={clearEvaporatedNotice}
            className="text-paper-muted hover:text-paper-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Editorial Hero: Real left-aligned asymmetrical layout */}
      <div className="mb-14 sm:mb-18 max-w-3xl">
        <h1 className="font-display text-4xl sm:text-6xl md:text-[clamp(2.5rem,5.5vw,4.25rem)] font-bold tracking-tight text-paper-white leading-[1.04]">
          Say it. Then let it <strong className="font-extrabold text-paper-white">evaporate.</strong>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-paper-muted leading-relaxed font-body max-w-[52ch]">
          No accounts. No logs. Pools live in volatile memory and vanish when the last person leaves.
        </p>

        {/* Understated Inline Alias Editor */}
        <div className="mt-8 flex items-center gap-3 text-xs">
          <span className="text-paper-muted select-none">Speaking as:</span>
          <form data-idle-exclude="alias" onSubmit={handleSaveAlias} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Your nickname..."
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              maxLength={24}
              className="w-36 sm:w-44 border-b border-surface-border bg-transparent pb-0.5 text-xs sm:text-sm text-paper-white placeholder-paper-faint focus:border-ink-indigo focus:outline-none transition-colors"
            />

            <button
              type="button"
              onClick={handleShuffleAlias}
              className="p-1 rounded-md text-paper-muted hover:text-paper-white hover:bg-surface-elevated transition-colors"
              title="Shuffle nickname"
            >
              <Dices className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>

            <button
              type="submit"
              disabled={!aliasInput.trim() || aliasInput === username}
              className="text-[11px] font-medium text-ink-teal hover:underline disabled:opacity-30 disabled:no-underline transition-all cursor-pointer"
            >
              {aliasSaved ? (
                <span className="inline-flex items-center gap-1 text-ink-teal">
                  <Check className="h-3 w-3" strokeWidth={1.5} /> Saved
                </span>
              ) : (
                'Set'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Waking State Banner (Cold-start handling with elapsed seconds and subtle drop pulse) */}
      {isWaking && (
        <div
          className="mb-8 rounded-2xl border border-ink-amber/25 bg-surface-base/80 p-5 sm:p-6 backdrop-blur-md transition-all shadow-sm animate-fade-in"
          aria-live="polite"
        >
          <div className="flex items-start gap-4">
            {/* Subtle animated drop/ripple without generic spinner */}
            <div className="relative flex h-8 w-8 items-center justify-center shrink-0 mt-0.5">
              <span className="absolute h-8 w-8 rounded-full border border-ink-amber/40 animate-ping opacity-60" />
              <span className="h-3 w-3 rounded-full bg-ink-amber shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-paper-white">
                  Waking the server…
                </h3>
                <span className="font-mono text-xs text-ink-amber">
                  {wakingElapsedSeconds}s elapsed
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-paper-muted font-body leading-relaxed max-w-[52ch]">
                Free instances sleep after inactivity. This cold start can take up to a minute — the pools will bloom the moment it wakes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offline State Banner (90s Graceful give-up with Retry CTA) */}
      {isOffline && (
        <div
          className="mb-8 rounded-2xl border border-ink-rose/30 bg-surface-base/80 p-5 sm:p-6 backdrop-blur-md transition-all shadow-sm animate-fade-in"
          aria-live="polite"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="h-3 w-3 rounded-full bg-ink-rose shrink-0 mt-1" />
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-paper-white">
                  Server isn&apos;t responding
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-paper-muted font-body leading-relaxed max-w-[50ch]">
                  The gateway hasn&apos;t answered after 90 seconds. It may still be booting or encountering network limits.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={retryConnection}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-ink-indigo text-white hover:bg-ink-indigo/90 transition-colors shadow-sm cursor-pointer shrink-0"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Refresh, and Create Pool sharing 40px (h-10) baseline */}
      {hasAnyPools && (
        <div data-idle-exclude="toolbar" className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-muted" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search pools by title or id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 rounded-xl border border-surface-border bg-surface-base/80 pl-10 pr-4 text-xs sm:text-sm text-paper-white placeholder-paper-faint focus:border-ink-indigo focus:outline-none transition-colors backdrop-blur-sm"
            />
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5">
            <RippleButton
              variant="secondary"
              size="md"
              onClick={handleRefresh}
              disabled={!isConnected}
              title={!isConnected ? 'Connecting to server...' : 'Refresh pools'}
              className="h-10 rounded-xl disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-ink-teal' : ''}`} strokeWidth={1.5} />
              <span className="hidden sm:inline">Refresh</span>
            </RippleButton>

            <RippleButton
              data-idle-exclude="cta"
              variant="primary"
              size="md"
              disabled={!isConnected}
              title={!isConnected ? 'Connecting to server...' : 'Create a new pool'}
              onClick={() => setIsCreateOpen(true)}
              className="h-10 rounded-xl disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span>Create Pool</span>
            </RippleButton>
          </div>
        </div>
      )}

      {/* Pools Grid or Loading Skeleton / Empty State */}
      {isWaking || (connectionStatus === 'connecting' && !hasAnyPools) ? (
        /* Waking / Cold-Start Skeleton Cards (keeps layout visible, quiet loading state) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 py-4 animate-fade-in">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex flex-col justify-between rounded-2xl border border-surface-border/50 bg-surface-base/40 p-5 sm:p-6 backdrop-blur-sm animate-pulse min-h-[160px]"
            >
              <div className="space-y-3">
                <div className="h-5 w-3/4 rounded bg-surface-elevated/70" />
                <div className="h-3 w-1/3 rounded bg-surface-elevated/40" />
              </div>
              <div className="border-t border-surface-border/40 pt-4 flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-surface-elevated/40" />
                <div className="h-6 w-14 rounded-lg bg-surface-elevated/50" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasAnyPools ? (
        /* Empty State (Drawn directly on water background, left-aligned) */
        <div className="py-12 sm:py-20 max-w-xl animate-ink-drop">
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-paper-white leading-[1.08]">
            The water&apos;s still. Drop the first ink.
          </h2>

          <p className="mt-3 text-sm sm:text-base text-paper-muted leading-relaxed font-body max-w-[48ch]">
            All previous conversations have evaporated from memory. Create a public pool or lock one with a secret passcode to begin.
          </p>

          {/* Single primary CTA when list is empty */}
          <div className="mt-7">
            <RippleButton
              data-idle-exclude="cta"
              variant="primary"
              size="lg"
              disabled={!isConnected}
              title={!isConnected ? 'Connecting to server...' : 'Create a new pool'}
              onClick={() => setIsCreateOpen(true)}
              className="h-11 rounded-xl disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span>Create Pool</span>
            </RippleButton>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        /* Filter found no results */
        <div className="py-16 max-w-md animate-ink-drop">
          <p className="font-display text-2xl text-paper-white font-semibold">
            No pools match &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-paper-muted mt-2">
            Clear the filter or create a new pool with this name.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 text-xs text-ink-teal hover:underline font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
        /* Grid of Active Pools */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredRooms.map((room) => (
            <PoolCard key={room.id} room={room} onEnter={handleEnterPool} />
          ))}
        </div>
      )}

      {/* Editorial Micro-Notes */}
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-surface-border pt-10">
        <div>
          <h4 className="font-display text-base font-semibold text-paper-white mb-1.5">
            In-flight scrubbing
          </h4>
          <p className="text-xs text-paper-muted leading-relaxed font-body max-w-[40ch]">
            A synchronous Trie filter normalizes obfuscations and masks profanities into equivalent asterisks before fan-out.
          </p>
        </div>

        <div>
          <h4 className="font-display text-base font-semibold text-paper-white mb-1.5">
            Sliding-window rate limit
          </h4>
          <p className="text-xs text-paper-muted leading-relaxed font-body max-w-[40ch]">
            Bursts are capped to 5 messages per 2-second rolling window. Image transmissions are throttled to 3 per 10 seconds.
          </p>
        </div>

        <div>
          <h4 className="font-display text-base font-semibold text-paper-white mb-1.5">
            Zero-disk architecture
          </h4>
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
    </div>
  );
}

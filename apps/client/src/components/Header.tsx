'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSocket } from '../hooks/useSocket';
import { DropLogo } from './DropLogo';
import { Check, Edit3, Settings } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const { connectionStatus, wakingElapsedSeconds, latencyMs, username, setUsername } = useSocket();
  const [mounted, setMounted] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [tempAlias, setTempAlias] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartEdit = () => {
    setTempAlias(username);
    setIsEditingAlias(true);
  };

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempAlias.trim()) {
      setUsername(tempAlias.trim());
    }
    setIsEditingAlias(false);
  };

  // Status color mapping: teal = connected, amber = waking/reconnecting, rose = offline
  const statusColor = {
    connected: 'bg-ink-teal',
    waking: 'bg-ink-amber',
    reconnecting: 'bg-ink-amber',
    offline: 'bg-ink-rose',
    connecting: 'bg-ink-amber',
  }[connectionStatus];

  const statusLabel = {
    connected: latencyMs !== null ? `~${latencyMs}ms` : 'connected',
    waking: `waking (${wakingElapsedSeconds}s)`,
    reconnecting: 'reconnecting...',
    offline: 'offline',
    connecting: 'connecting...',
  }[connectionStatus];

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-surface-border bg-water-deep/90 backdrop-blur-md transition-colors"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
    >
      <div className="ink-container flex h-16 items-center justify-between">
        {/* Logo & Ticket-Stub Subtitle */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-h-[44px]">
          <DropLogo size={26} />
          <div className="flex items-center gap-2">
            <span className="font-display text-lg xs:text-xl sm:text-2xl font-bold tracking-tight text-paper-white group-hover:text-white transition-colors">
              InkDrop
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded border border-dashed border-surface-border bg-surface-elevated/40 text-paper-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-teal" />
              <span>evaporates on exit</span>
            </span>
          </div>
        </Link>

        {/* Right Status Cluster */}
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 shrink-0">
          {/* Connection Status Dot & Ping */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 px-1.5 py-1 rounded-lg"
            title={`Status: ${statusLabel}`}
            aria-label={`Status: ${statusLabel}`}
          >
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span
                className={`absolute h-full w-full rounded-full opacity-60 ${statusColor} ${
                  connectionStatus === 'connected'
                    ? 'animate-ping'
                    : connectionStatus === 'waking' || connectionStatus === 'reconnecting'
                    ? 'animate-pulse'
                    : ''
                }`}
              />
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${statusColor} ${
                  connectionStatus === 'connected' ? 'shadow-[0_0_6px_rgba(45,212,191,0.7)]' : ''
                }`}
              />
            </div>

            <span className="hidden sm:inline font-mono text-[10px] text-paper-muted">
              {statusLabel}
            </span>
          </div>

          {/* User Alias Display (Rendered post-hydration for zero mismatch) */}
          {mounted && username && (
            <div className="border-l border-surface-border pl-2 xs:pl-3">
              {isEditingAlias ? (
                <form onSubmit={handleSaveAlias} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    maxLength={20}
                    className="w-24 xs:w-28 rounded-lg border border-ink-indigo bg-surface-base px-2 py-1 text-xs text-paper-white focus:outline-none"
                    autoFocus
                    onBlur={() => setIsEditingAlias(false)}
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] min-w-[36px] flex items-center justify-center p-1 rounded-md text-ink-teal hover:bg-surface-elevated transition-colors"
                    title="Save alias"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="group/alias flex items-center gap-1 xs:gap-1.5 rounded-lg border border-surface-border bg-surface-elevated/70 px-2 xs:px-2.5 py-1.5 text-xs text-paper-white hover:border-surface-border-hover transition-all select-none min-h-[40px]"
                  title="Click to rename yourself"
                >
                  <span className="text-paper-muted text-[11px] hidden xs:inline">as:</span>
                  <span className="text-paper-white max-w-[70px] xs:max-w-[95px] sm:max-w-[120px] truncate font-medium">
                    {username}
                  </span>
                  <Edit3 className="h-3 w-3 text-paper-muted opacity-40 group-hover/alias:opacity-100 transition-opacity shrink-0" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Settings Trigger Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-paper-muted hover:text-paper-white hover:bg-surface-elevated transition-colors border border-transparent hover:border-surface-border cursor-pointer"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Settings Modal (Rendered via Portal) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
}

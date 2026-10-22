'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { X, Moon, Sun, Monitor, Sparkles, Check, Volume2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { generateRandomAlias } from '../theme/tokens';
import { playSendSound, playMessageChime, playSystemChime } from '../lib/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { soundEnabled, setSoundEnabled, volume, setVolume, username, setUsername } = useSettings();

  const [mounted, setMounted] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaved, setAliasSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (username) {
      setAliasInput(username);
    }
  }, [username]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on first interactive element
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector<HTMLElement>('input, button');
      firstInput?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const handleSaveAlias = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = aliasInput.trim();
    if (clean) {
      setUsername(clean);
      setAliasSaved(true);
      setTimeout(() => setAliasSaved(false), 2000);
    }
  };

  const handleShuffle = () => {
    const fresh = generateRandomAlias();
    setAliasInput(fresh);
    setUsername(fresh);
    setAliasSaved(true);
    setTimeout(() => setAliasSaved(false), 2000);
  };

  const isSaveDisabled = !aliasInput.trim() || aliasInput.trim() === username;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-150 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-2xl bg-surface-base border border-surface-border shadow-2xl p-6 sm:p-7 relative transition-all duration-200 transform scale-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <h2 id="settings-title" className="text-xl sm:text-2xl font-display font-semibold tracking-tight text-paper-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings modal"
            className="p-1.5 rounded-lg text-paper-muted hover:text-paper-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* 1. Theme Selector (Appearance FIRST) */}
          <div>
            <label className="block text-xs font-sans font-medium text-paper-muted mb-2.5 uppercase tracking-wider">
              Appearance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'dark', label: 'Dark', icon: Moon },
                { key: 'light', label: 'Light', icon: Sun },
                { key: 'system', label: 'System', icon: Monitor },
              ].map(({ key, label, icon: Icon }) => {
                const isActive = mounted && theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      isActive
                        ? 'border-ink-indigo bg-ink-indigo/15 text-paper-white shadow-sm ring-1 ring-ink-indigo/30'
                        : 'border-surface-border bg-surface-elevated/60 text-paper-muted hover:text-paper-white hover:border-surface-border-hover'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Audio Cues, Volume & Previews */}
          <div className="border-t border-surface-border pt-4">
            <div className="flex items-center justify-between py-1">
              <div className="pr-4">
                <span className="block text-sm font-medium text-paper-white">
                  Audio cues
                </span>
                <span className="block text-xs text-paper-muted mt-0.5">
                  Synthesized sine-wave chimes for drops, sends, and pool events
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo ${
                  soundEnabled ? 'bg-ink-teal' : 'bg-surface-elevated'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Volume Slider */}
            <div className={`mt-3.5 space-y-1.5 transition-opacity ${soundEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-paper-muted flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Volume</span>
                </span>
                <span className="font-mono text-[11px] text-paper-white">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                onPointerUp={() => playSendSound(true)}
                onKeyUp={() => playSendSound(true)}
                className="w-full h-1.5 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-ink-teal"
              />
            </div>

            {/* Cue Preview Row */}
            <div className="mt-3.5 pt-3 border-t border-surface-border/50">
              <span className="block text-[11px] font-sans font-medium text-paper-muted uppercase tracking-wider mb-2">
                Preview cues
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playSendSound(true)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-surface-border bg-surface-elevated/70 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => playMessageChime(true)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-surface-border bg-surface-elevated/70 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  Receive
                </button>
                <button
                  type="button"
                  onClick={() => playSystemChime(true)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-surface-border bg-surface-elevated/70 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  Join/leave
                </button>
              </div>
            </div>
          </div>

          {/* 3. Alias / Nickname Editor */}
          <div className="border-t border-surface-border pt-4">
            <label
              htmlFor="settings-alias"
              className="block text-xs font-sans font-medium text-paper-muted mb-2.5 uppercase tracking-wider"
            >
              Default nickname
            </label>
            <form onSubmit={handleSaveAlias} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="settings-alias"
                  type="text"
                  maxLength={24}
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Stranger_0000"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-surface-elevated border border-surface-border text-paper-white placeholder-paper-muted/50 focus:outline-none focus:border-ink-indigo transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleShuffle}
                title="Shuffle alias"
                className="px-2.5 py-2 rounded-xl border border-surface-border bg-surface-elevated text-paper-muted hover:text-paper-white hover:border-surface-border-hover transition-colors flex items-center justify-center shrink-0"
              >
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                  aliasSaved
                    ? 'bg-ink-teal/20 text-ink-teal border border-ink-teal/40'
                    : isSaveDisabled
                    ? 'bg-surface-elevated text-paper-muted/40 border border-surface-border cursor-not-allowed opacity-50'
                    : 'bg-ink-indigo text-white hover:bg-ink-indigo/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] cursor-pointer'
                }`}
              >
                {aliasSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 4. Footer with Done Button */}
        <div className="mt-7 pt-4 border-t border-surface-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-surface-elevated text-paper-white hover:bg-surface-elevated/80 border border-surface-border transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

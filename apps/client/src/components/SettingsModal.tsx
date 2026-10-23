'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Sparkles, Check, Volume2 } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { generateRandomAlias } from '../theme/tokens';
import { playSendSound, playMessageChime, playSystemChime } from '../lib/audio';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const {
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    username,
    setUsername,
    cursorGlowEnabled,
    setCursorGlowEnabled,
    lowEffectsMode,
    setLowEffectsMode,
  } = useSettings();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaved, setAliasSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (username) {
      setAliasInput(username);
    }
  }, [username]);

  const handleSaveAlias = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = aliasInput.trim();
    if (clean && clean !== username) {
      setUsername(clean);
      setAliasSaved(true);
      toast.success('Default nickname saved');
      setTimeout(() => setAliasSaved(false), 2000);
    }
  };

  const handleShuffle = () => {
    const fresh = generateRandomAlias();
    setAliasInput(fresh);
    setUsername(fresh);
    setAliasSaved(true);
    toast.success('Nickname randomized');
    setTimeout(() => setAliasSaved(false), 2000);
  };

  const isSaveDisabled = !aliasInput.trim() || aliasInput.trim() === username;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Preferences"
      subtitle="Theme, sound synthesizer, and local identity"
      accent="indigo"
    >
      <div className="space-y-6">
        {/* 1. Theme Selector */}
        <div>
          <label className="block text-xs font-sans font-medium text-paper-muted mb-2.5 uppercase tracking-wider select-none">
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
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors duration-150 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep ${
                    isActive
                      ? 'border-ink-indigo bg-ink-indigo/15 text-paper-white shadow-sm ring-1 ring-ink-indigo/40'
                      : 'border-surface-border bg-surface-base/60 text-paper-muted hover:text-paper-white hover:border-surface-border-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Ambience & Water Light */}
        <div className="border-t border-surface-border pt-4">
          <div className="flex items-center justify-between py-1">
            <div className="pr-4">
              <span className="block text-sm font-medium text-paper-white">
                Cursor glow
              </span>
              <span className="block text-xs text-paper-muted mt-0.5">
                Soft water-light aura trailing pointer across the canvas
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cursorGlowEnabled}
              aria-label="Toggle cursor glow"
              onClick={() => setCursorGlowEnabled(!cursorGlowEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo ${
                cursorGlowEnabled ? 'bg-ink-teal' : 'bg-surface-elevated'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  cursorGlowEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Low Effects Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-surface-border/40 mt-2">
            <div className="pr-4">
              <span className="block text-sm font-medium text-paper-white">
                Low effects mode
              </span>
              <span className="block text-xs text-paper-muted mt-0.5">
                Disable page glow, idle ripples, and blurs for maximum responsiveness and low power
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={lowEffectsMode}
              aria-label="Toggle low effects mode"
              onClick={() => setLowEffectsMode(!lowEffectsMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo ${
                lowEffectsMode ? 'bg-ink-teal' : 'bg-surface-elevated'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  lowEffectsMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 3. Audio Cues & Volume */}
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
              aria-label="Toggle audio cues"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo ${
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
          <div
            className={`mt-4 space-y-1.5 transition-opacity ${
              soundEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-sans select-none">
              <span className="text-paper-muted flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Volume</span>
              </span>
              <span className="font-mono text-[11px] text-paper-white">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label="Audio cue volume"
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              onPointerUp={() => playSendSound(true)}
              onKeyUp={() => playSendSound(true)}
              className="w-full h-1.5 bg-surface-base rounded-lg appearance-none cursor-pointer accent-ink-teal"
            />
          </div>

          {/* Cue Preview Row */}
          <div className="mt-4 pt-3 border-t border-surface-border/50">
            <span className="block text-[11px] font-sans font-medium text-paper-muted uppercase tracking-wider mb-2 select-none">
              Test Audio Cues
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playSendSound(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-base/80 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer min-h-[36px]"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => playMessageChime(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-base/80 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer min-h-[36px]"
              >
                Receive
              </button>
              <button
                type="button"
                onClick={() => playSystemChime(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-base/80 text-paper-white hover:border-surface-border-hover hover:bg-surface-elevated transition-colors cursor-pointer min-h-[36px]"
              >
                Join / Evaporate
              </button>
            </div>
          </div>
        </div>

        {/* 3. Nickname Editor */}
        <div className="border-t border-surface-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="settings-alias"
              className="block text-xs font-sans font-medium text-paper-muted uppercase tracking-wider select-none"
            >
              Default Nickname
            </label>
            <span className="font-mono text-[10px] text-paper-muted">
              {aliasInput.length} / 24
            </span>
          </div>

          <form onSubmit={handleSaveAlias} className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="settings-alias"
                type="text"
                maxLength={24}
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Stranger_0000"
                autoComplete="off"
                className="w-full h-11 px-3.5 text-sm rounded-xl bg-surface-base/90 border border-surface-border text-paper-white placeholder-paper-faint focus:outline-none focus:ring-2 focus:ring-ink-indigo transition-colors duration-150"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleShuffle}
              title="Shuffle alias"
              aria-label="Shuffle alias"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaveDisabled}
              leftIcon={
                aliasSaved ? (
                  <Check className="w-4 h-4 text-ink-teal" strokeWidth={1.5} />
                ) : undefined
              }
            >
              {aliasSaved ? 'Saved' : 'Save'}
            </Button>
          </form>
          <p className="mt-1.5 text-[11px] text-paper-muted">
            Stored locally on your machine. Never tracked or linked to identity.
          </p>
        </div>

        {/* 4. Footer */}
        <div className="pt-4 border-t border-surface-border flex justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

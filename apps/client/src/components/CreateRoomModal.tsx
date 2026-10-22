'use client';

import React, { useState } from 'react';
import { Lock, Unlock, Loader2, Plus, Clock } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useRouter } from 'next/navigation';
import { InkModal } from './InkModal';
import { RippleButton } from './RippleButton';
import { TTLMinutes } from '../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const { createRoom } = useSocket();

  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState<TTLMinutes>(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please give your pool a name.');
      return;
    }

    if (isPrivate && !password.trim()) {
      setError('A passcode is required for private pools.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const savedUsername =
        (typeof window !== 'undefined'
          ? localStorage.getItem('inkdrop_username') || localStorage.getItem('inkdrop_alias')
          : null) || undefined;

      const res = await createRoom(
        name.trim(),
        isPrivate ? password.trim() : undefined,
        savedUsername,
        ttlMinutes
      );
      if (res.success && res.room) {
        onClose();
        setName('');
        setPassword('');
        setIsPrivate(false);
        setTtlMinutes(15);
        router.push(`/room/${res.room.id}`);
      } else {
        setError(res.error || 'Failed to initialize pool.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const ttlOptions: { label: string; value: TTLMinutes; sub: string }[] = [
    { label: '5m', value: 5, sub: 'Quick drop' },
    { label: '15m', value: 15, sub: 'Standard' },
    { label: '1h', value: 60, sub: 'Extended' },
    { label: '∞', value: null, sub: 'Until empty' },
  ];

  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="Drop a new pool"
      subtitle="Lives in memory only. Vanishes when the last person leaves or time expires."
      accent="indigo"
    >
      {error && (
        <div className="mb-4 rounded-xl border border-ink-rose/30 bg-ink-rose/10 px-3.5 py-2 text-xs text-ink-rose">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-sans text-paper-muted mb-1.5">
            Pool title
          </label>
          <input
            type="text"
            placeholder="e.g. Midnight Sync, Notes, Whispers..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-xl border border-surface-border bg-surface-base/90 px-3.5 py-2 text-sm text-paper-white placeholder-paper-faint focus:border-ink-indigo focus:outline-none transition-all"
            autoFocus
          />
        </div>

        {/* Self-Destruct Lifetime Selector */}
        <div>
          <label className="text-xs font-sans text-paper-muted mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ink-indigo" strokeWidth={1.5} />
            <span>Lifetime (TTL)</span>
          </label>
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
            {ttlOptions.map((opt) => {
              const isSelected = ttlMinutes === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setTtlMinutes(opt.value)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center min-h-[44px] ${
                    isSelected
                      ? 'border-ink-indigo bg-ink-indigo/15 text-paper-white shadow-sm ring-1 ring-ink-indigo/40'
                      : 'border-surface-border bg-surface-base/60 text-paper-muted hover:text-paper-white hover:border-surface-border-hover'
                  }`}
                >
                  <span className="text-xs font-semibold font-mono">{opt.label}</span>
                  <span className="text-[10px] opacity-75 font-sans">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <label className="flex items-center justify-between cursor-pointer rounded-xl border border-surface-border bg-surface-base/60 p-3 hover:border-surface-border-hover transition-colors">
            <span className="text-xs text-paper-white flex items-center gap-2">
              {isPrivate ? (
                <Lock className="h-3.5 w-3.5 text-ink-rose" strokeWidth={1.5} />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-paper-muted" strokeWidth={1.5} />
              )}
              <span>Require secret passcode</span>
            </span>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border bg-surface-base text-ink-indigo focus:ring-0 cursor-pointer"
            />
          </label>
        </div>

        {isPrivate && (
          <div>
            <label className="block text-xs font-sans text-paper-muted mb-1.5">
              Secret passcode
            </label>
            <input
              type="password"
              placeholder="Enter passphrase..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-base/90 px-3.5 py-2 text-sm text-paper-white placeholder-paper-faint focus:border-ink-rose focus:outline-none transition-all"
            />
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-surface-border">
          <RippleButton
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </RippleButton>
          <RippleButton
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            <span>Create Pool</span>
          </RippleButton>
        </div>
      </form>
    </InkModal>
  );
}

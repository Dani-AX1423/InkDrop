'use client';

import React, { useState } from 'react';
import { Lock, Loader2, KeyRound } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useRouter } from 'next/navigation';
import { PublicRoomInfo } from '../types';
import { InkModal } from './InkModal';
import { RippleButton } from './RippleButton';

interface PasswordPromptModalProps {
  room: PublicRoomInfo | null;
  onClose: () => void;
}

export function PasswordPromptModal({ room, onClose }: PasswordPromptModalProps) {
  const router = useRouter();
  const { joinRoom } = useSocket();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!room) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Passcode is required to enter this pool.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const savedUsername =
        (typeof window !== 'undefined'
          ? localStorage.getItem('inkdrop_username') || localStorage.getItem('inkdrop_alias')
          : null) || undefined;

      const res = await joinRoom(room.id, password, savedUsername);
      if (res.success && res.room) {
        onClose();
        router.push(`/room/${room.id}`);
      } else {
        setError(res.error || 'The passcode was rejected. Entry denied.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failure';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InkModal
      isOpen={Boolean(room)}
      onClose={onClose}
      title="Locked Pool"
      subtitle={room.name}
      accent="rose"
    >
      {error && (
        <div className="mb-4 rounded-xl border border-ink-rose/30 bg-ink-rose/10 px-3.5 py-2 text-xs text-ink-rose animate-fadeIn">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-sans text-paper-muted mb-1.5">
            Passcode
          </label>
          <div className="relative">
            <input
              type="password"
              placeholder="Enter passcode..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-base/90 pl-10 pr-4 py-2 text-sm text-paper-white placeholder-paper-faint focus:border-ink-rose focus:outline-none transition-all font-mono"
              autoFocus
            />
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-muted" strokeWidth={1.5} />
          </div>
        </div>

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
            variant="rose"
            size="md"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            <span>Unlock Pool</span>
          </RippleButton>
        </div>
      </form>
    </InkModal>
  );
}

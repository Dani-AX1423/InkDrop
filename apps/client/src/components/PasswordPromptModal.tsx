'use client';

import React, { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useRouter } from 'next/navigation';
import { PublicRoomInfo } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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
    if (!password.trim()) {
      setError('A passcode is required to enter this pool.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const savedUsername =
        (typeof window !== 'undefined'
          ? localStorage.getItem('inkdrop_username') || localStorage.getItem('inkdrop_alias')
          : null) || undefined;

      const res = await joinRoom(room.id, password.trim(), savedUsername);
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
    <Modal
      isOpen={Boolean(room)}
      onClose={onClose}
      title="Locked Pool"
      subtitle={room.name}
      accent="rose"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-ink-rose/30 bg-ink-rose/10 px-3.5 py-2.5 text-xs text-ink-rose flex items-center gap-2 animate-fade-in"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ink-rose shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Passcode"
          type="password"
          placeholder="Enter secret passphrase..."
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          leftIcon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}
          autoComplete="off"
          autoFocus
        />

        <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-surface-border">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="danger"
            size="md"
            disabled={!password.trim() || loading}
            isLoading={loading}
            leftIcon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
          >
            Unlock Pool
          </Button>
        </div>
      </form>
    </Modal>
  );
}

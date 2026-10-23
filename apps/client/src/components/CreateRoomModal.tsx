'use client';

import React, { useState } from 'react';
import { Lock, Unlock, Plus, Clock } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useRouter } from 'next/navigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';
import { TTLMinutes } from '../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const { createRoom } = useSocket();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState<TTLMinutes>(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = Boolean(name.trim() && (!isPrivate || password.trim().length >= 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please give your pool a name.');
      return;
    }

    if (isPrivate && !password.trim()) {
      setError('A secret passcode is required for locked pools.');
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
        toast.success(`Pool "${name.trim()}" established`);
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
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Drop a new pool"
      subtitle="Lives in volatile memory only. Dissolves when empty or expired."
      accent="indigo"
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
          label="Pool Title"
          placeholder="e.g. Midnight Sync, Notes, Whispers..."
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          maxLength={40}
          currentLength={name.length}
          showCounter
          autoComplete="off"
          autoFocus
        />

        {/* Self-Destruct Lifetime Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-sans font-medium text-paper-muted flex items-center gap-1.5 select-none">
            <Clock className="w-3.5 h-3.5 text-ink-indigo" strokeWidth={1.5} />
            <span>Scheduled Lifetime (TTL)</span>
          </label>
          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
            {ttlOptions.map((opt) => {
              const isSelected = ttlMinutes === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setTtlMinutes(opt.value)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors duration-150 text-center min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep ${
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

        {/* Locked Pool Toggle */}
        <div className="pt-1">
          <label className="flex items-center justify-between cursor-pointer rounded-xl border border-surface-border bg-surface-base/60 p-3 hover:border-surface-border-hover transition-colors">
            <span className="text-xs text-paper-white flex items-center gap-2 select-none">
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
              className="h-4 w-4 rounded border-surface-border bg-surface-base text-ink-indigo focus:ring-ink-indigo cursor-pointer"
            />
          </label>
        </div>

        {/* Passcode Input */}
        {isPrivate && (
          <Input
            label="Secret Passcode"
            type="password"
            placeholder="Enter passphrase..."
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            maxLength={32}
            autoComplete="off"
            helperText="Anyone entering will need this code. Forgotten on dissolve."
          />
        )}

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
            variant="primary"
            size="md"
            disabled={!isFormValid || loading}
            isLoading={loading}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={1.5} />}
          >
            Create Pool
          </Button>
        </div>
      </form>
    </Modal>
  );
}

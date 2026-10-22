'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Share2, Clock, ShieldAlert } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  isPrivate: boolean;
  expiresAt?: number;
}

export function ShareModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  isPrivate,
  expiresAt,
}: ShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/room/${roomId}`);
    }
  }, [roomId]);

  // Lock body scroll while open
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
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      const copyBtn = modalRef.current?.querySelector<HTMLElement>('[data-copy-button]');
      copyBtn?.focus();
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full sm:max-w-sm max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl bg-surface-base border-t sm:border border-surface-border shadow-2xl p-6 relative pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="sm:hidden flex justify-center -mt-2 mb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-ink-teal" strokeWidth={1.5} />
            <h2 id="share-modal-title" className="text-xl font-display font-bold text-paper-white">
              Share Pool
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-paper-muted hover:text-paper-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="mt-5 flex flex-col items-center">
          <div className="p-4 rounded-xl bg-white shadow-md border border-white/20">
            <QRCodeSVG
              value={shareUrl}
              size={180}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#05070C"
              includeMargin={false}
            />
          </div>
          <p className="mt-2.5 text-[11px] font-mono text-paper-muted tracking-tight">
            ID: <span className="text-paper-white font-medium">{roomId}</span>
          </p>
        </div>

        {/* Info & Notices */}
        {expiresAt ? (
          <div className="mt-4 flex items-center gap-2 p-2.5 rounded-xl bg-ink-rose/10 border border-ink-rose/25 text-xs text-paper-white">
            <Clock className="w-4 h-4 text-ink-rose shrink-0" strokeWidth={1.5} />
            <span className="font-body">
              This pool has a self-destruct timer and will dissolve when the countdown completes.
            </span>
          </div>
        ) : null}

        {isPrivate && (
          <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-ink-amber/10 border border-ink-amber/25 text-xs text-paper-white">
            <ShieldAlert className="w-4 h-4 text-ink-amber shrink-0" strokeWidth={1.5} />
            <span className="font-body">
              Passcode protected. Invitees will be prompted for the secret passkey upon arrival.
            </span>
          </div>
        )}

        {/* Link Field & Copy Button */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-surface-elevated border border-surface-border text-paper-muted select-all focus:outline-none"
          />
          <button
            type="button"
            data-copy-button
            onClick={handleCopy}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              copied
                ? 'bg-ink-teal/20 text-ink-teal border border-ink-teal/40'
                : 'bg-ink-indigo text-white hover:bg-ink-indigo/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Live region for screen readers */}
        <div aria-live="polite" className="sr-only">
          {copied ? 'Room link copied to clipboard' : ''}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

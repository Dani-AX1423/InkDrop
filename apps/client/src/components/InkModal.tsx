'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface InkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: 'indigo' | 'rose' | 'teal';
  children: React.ReactNode;
}

export function InkModal({
  isOpen,
  onClose,
  title,
  subtitle,
  accent = 'indigo',
  children,
}: InkModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const accentBleed = {
    indigo: 'bg-ink-indigo/15 border-ink-indigo/30',
    rose: 'bg-ink-rose/15 border-ink-rose/30',
    teal: 'bg-ink-teal/15 border-ink-teal/30',
  }[accent];

  const modalElement = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Ink Bloom Animated Container / Mobile Bottom Sheet */}
      <div
        className="relative w-full sm:max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl border-t sm:border border-surface-border bg-surface-elevated/98 p-6 sm:p-7 shadow-2xl animate-ink-bloom pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{
          boxShadow: '0 -10px 40px -10px rgba(0, 0, 0, 0.9), 0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        }}
      >
        {/* Mobile Drag Indicator Bar on Phones */}
        <div className="sm:hidden flex justify-center -mt-2 mb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Soft radial ink bleed in corner */}
        <div
          className={`pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-60 ${accentBleed}`}
        />

        {/* Modal Header */}
        <div className="relative z-10 flex items-start justify-between pb-4 border-b border-surface-border">
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-paper-white">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 font-body text-xs text-paper-muted leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 mt-5">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}

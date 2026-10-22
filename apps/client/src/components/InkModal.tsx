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
      className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Ink Bloom Animated Container */}
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-2xl border border-surface-border bg-surface-elevated/95 p-6 sm:p-7 shadow-2xl animate-ink-bloom"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        }}
      >
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
            className="rounded-lg p-1.5 text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors"
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

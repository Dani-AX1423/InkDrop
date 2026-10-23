'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: 'indigo' | 'rose' | 'teal' | 'amber';
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  accent = 'indigo',
  children,
  maxWidth = 'md',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const subtitleId = useId();

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

  // Focus trap, Escape key, and Focus restore
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

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

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

    // Initial focus onto the first input or primary button inside the modal
    const timer = setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([aria-label="Close modal"]):not([disabled])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        modalRef.current?.focus();
      }
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

  const accentBleed = {
    indigo: 'bg-ink-indigo/15 border-ink-indigo/30',
    rose: 'bg-ink-rose/15 border-ink-rose/30',
    teal: 'bg-ink-teal/15 border-ink-teal/30',
    amber: 'bg-ink-amber/15 border-ink-amber/30',
  }[accent];

  const maxWidthStyles = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  }[maxWidth];

  const modalElement = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Ink Bloom Container on Desktop / Bottom Sheet on Mobile */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidthStyles} max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl border-t sm:border border-surface-border bg-surface-elevated p-6 sm:p-7 shadow-2xl animate-ink-bloom outline-none pb-[max(1.5rem,env(safe-area-inset-bottom))]`}
        style={{
          boxShadow: '0 -10px 40px -10px rgba(0, 0, 0, 0.8), 0 25px 60px -15px rgba(0, 0, 0, 0.9)',
        }}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex justify-center -mt-2 mb-4" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-paper-muted/30" />
        </div>

        {/* Soft radial ink glow in background */}
        <div
          className={`pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-50 ${accentBleed}`}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between pb-4 border-b border-surface-border gap-3">
          <div className="min-w-0 flex-1">
            <h3
              id={titleId}
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-paper-white"
            >
              {title}
            </h3>
            {subtitle && (
              <p
                id={subtitleId}
                className="mt-1 font-body text-xs text-paper-muted leading-relaxed"
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 mt-5">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}

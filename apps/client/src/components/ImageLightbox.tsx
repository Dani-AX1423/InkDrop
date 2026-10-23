'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { formatCensoredText, hasVisibleContent } from './MessageBubble';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageDataUrl: string;
  caption?: string;
}

export function ImageLightbox({
  isOpen,
  onClose,
  imageDataUrl,
  caption,
}: ImageLightboxProps) {
  const lightboxRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    lightboxRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={lightboxRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" strokeWidth={1.5} />
      </button>

      <div
        className="relative max-h-[85dvh] max-w-[92vw] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageDataUrl}
          alt={caption || 'Ephemeral drop'}
          className="max-h-[80dvh] max-w-[92vw] w-auto object-contain rounded-2xl shadow-2xl border border-white/10"
        />
        {caption && hasVisibleContent(caption) && (
          <p className="mt-3 text-sm text-paper-white text-center font-medium bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10 max-w-full truncate">
            {formatCensoredText(caption, false)}
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import type { ProcessedImageResult } from '../lib/image';
import { playErrorSound } from '../lib/audio';
import { useSettings } from '../hooks/useSettings';
import { ConnectionStatus } from '../types';

interface ChatComposerProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendImage: (dataUrl: string, caption?: string) => Promise<void>;
  connectionStatus: ConnectionStatus;
  isRateLimited: boolean;
  rateLimitProgress: number;
  externalImage?: ProcessedImageResult | null;
  onClearExternalImage?: () => void;
}

export function ChatComposer({
  onSendMessage,
  onSendImage,
  connectionStatus,
  isRateLimited,
  rateLimitProgress,
  externalImage,
  onClearExternalImage,
}: ChatComposerProps) {
  const { soundEnabled } = useSettings();
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<ProcessedImageResult | null>(null);
  const [imageProcessingError, setImageProcessingError] = useState<string | null>(null);

  // Sync external image dropped onto parent
  useEffect(() => {
    if (externalImage) {
      setPendingImage(externalImage);
      onClearExternalImage?.();
    }
  }, [externalImage, onClearExternalImage]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-grow textarea up to 6 lines (~144px)
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(144, Math.max(40, el.scrollHeight));
    el.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleIncomingFile = useCallback(
    async (file: File) => {
      setImageProcessingError(null);
      try {
        const { processDropImage } = await import('../lib/image');
        const res = await processDropImage(file);
        setPendingImage(res);
      } catch (err: unknown) {
        playErrorSound(soundEnabled);
        const errMsg = err instanceof Error ? err.message : 'Unsupported file or size exceeds 500KB.';
        setImageProcessingError(errMsg);
        setTimeout(() => setImageProcessingError(null), 4000);
      }
    },
    [soundEnabled]
  );

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isRateLimited || connectionStatus !== 'connected') return;

    if (pendingImage) {
      const caption = inputText.trim();
      const dataUrl = pendingImage.dataUrl;
      setPendingImage(null);
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = '40px';
      await onSendImage(dataUrl, caption || undefined);
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) return;

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = '40px';
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled =
    (!inputText.trim() && !pendingImage) ||
    isRateLimited ||
    connectionStatus !== 'connected';

  return (
    <div className="relative mb-2">
      {/* Error alert for image processing */}
      {imageProcessingError && (
        <div
          role="alert"
          className="mb-2 p-2.5 rounded-xl bg-ink-rose/15 border border-ink-rose/30 text-xs text-ink-rose flex items-center gap-2 animate-fade-in"
        >
          <span>{imageProcessingError}</span>
        </div>
      )}

      {/* Pending Image Preview Chip */}
      {pendingImage && (
        <div className="mb-2 inline-flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-surface-elevated border border-surface-border shadow-lg animate-fade-in">
          <img
            src={pendingImage.dataUrl}
            alt="Pending drop"
            className="w-10 h-10 object-cover rounded-lg border border-white/10"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-paper-white">
              Pending Image Drop
            </span>
            <span className="text-[10px] font-mono text-paper-muted">
              {Math.round(pendingImage.sizeBytes / 1024)} KB · {pendingImage.width}×{pendingImage.height}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            aria-label="Remove pending image"
            className="ml-2 p-1 rounded-md text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Composer Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated p-2 shadow-sm backdrop-blur-md">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          {/* Hidden file input for images */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                handleIncomingFile(files[0]);
              }
              e.target.value = '';
            }}
          />

          {/* Attach Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={connectionStatus !== 'connected'}
            aria-label="Attach image"
            title={
              connectionStatus !== 'connected'
                ? 'Connecting to server...'
                : 'Drop an image into pool (max 500KB)'
            }
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-paper-muted hover:text-ink-teal hover:bg-surface-base transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
          >
            <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
          </button>

          {/* Multi-line auto-growing textarea */}
          <div className="relative flex-1 flex flex-col justify-center">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRateLimited}
              rows={1}
              placeholder={
                isRateLimited
                  ? 'Waves settling...'
                  : pendingImage
                  ? 'Add an optional image caption...'
                  : 'Drop words into the dark water...'
              }
              maxLength={1000}
              aria-label="Message text"
              className={`w-full bg-transparent px-3 py-2 text-base sm:text-sm text-paper-white placeholder-paper-faint resize-none focus:outline-none transition-colors leading-relaxed ${
                isRateLimited ? 'opacity-40 italic cursor-not-allowed' : 'opacity-100'
              }`}
              style={{ maxHeight: '144px', minHeight: '40px' }}
            />

            {/* Character limit counter near limit (>800 chars) */}
            {inputText.length >= 800 && (
              <span className="self-end px-3 font-mono text-[10px] text-ink-amber select-none">
                {inputText.length} / 1000
              </span>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSendDisabled}
            aria-label="Send message"
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-ink-indigo text-white transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#4D4DEB] active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep"
            title={
              connectionStatus !== 'connected'
                ? 'Connecting to server...'
                : isRateLimited
                ? 'Rate limited'
                : 'Send drop'
            }
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </form>

        {/* Rate-Limit State: Ink Drying Progress Line */}
        {isRateLimited && (
          <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ink-rose via-ink-amber to-ink-rose transition-[width] ease-linear"
              style={{ width: `${rateLimitProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

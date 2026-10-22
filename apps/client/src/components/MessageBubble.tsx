'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, ZoomIn, Clock, ShieldAlert } from 'lucide-react';
import { ChatMessage } from '../types';
import { getInkColorForSender } from '../theme/tokens';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Lightbox focus trap and Escape handler
  useEffect(() => {
    if (!isLightboxOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsLightboxOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isLightboxOpen]);

  // System Message Representation
  if (message.isSystem) {
    const isExpire = message.systemType === 'expire';
    const isWarning = message.systemType === 'warning';

    return (
      <div className="flex justify-center my-3 animate-ink-drop">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border backdrop-blur-sm ${
            isExpire
              ? 'border-ink-rose/30 bg-ink-rose/10 text-ink-rose'
              : isWarning
              ? 'border-ink-amber/30 bg-ink-amber/10 text-ink-amber'
              : 'border-surface-border bg-surface-elevated/60 text-paper-muted'
          }`}
        >
          {isExpire && <Clock className="w-3 h-3" />}
          {isWarning && <ShieldAlert className="w-3 h-3" />}
          <span>{message.text}</span>
          <span className="text-[10px] opacity-60">· {formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  const senderTheme = getInkColorForSender(message.sender);
  const isImageMessage = message.messageType === 'image' && Boolean(message.imageDataUrl);

  return (
    <>
      <div
        className={`group flex flex-col mb-3 animate-ink-drop ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender Header */}
        <div className="flex items-center gap-2 mb-1 px-1">
          {!isOwn && (
            <span
              className="flex h-4 w-4 items-center justify-center rounded-teardrop text-[9px] font-bold text-white shadow-sm"
              style={{
                backgroundColor: senderTheme.color,
                borderRadius: '50% 50% 50% 0',
              }}
            >
              {message.sender.slice(0, 1).toUpperCase()}
            </span>
          )}

          <span
            className="text-xs font-medium tracking-tight"
            style={{ color: isOwn ? 'var(--paper-white)' : senderTheme.color }}
          >
            {isOwn ? 'You' : message.sender}
          </span>

          {/* Monospace Timestamp */}
          <span className="font-mono text-[10px] text-paper-muted/70 opacity-60 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Bubble with Organic Radii & Theme Tint */}
        <div
          className={`relative max-w-[88%] sm:max-w-md px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] transition-all ${
            isOwn
              ? 'rounded-drop bg-gradient-to-br from-[#4D4DFF] to-[#3939D4] text-white shadow-[0_4px_20px_-4px_rgba(91,91,255,0.35)] border border-indigo-400/25'
              : 'rounded-drop-other bg-surface-elevated text-paper-white border border-surface-border shadow-md'
          }`}
        >
          {/* Subtle radial sheen */}
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-20"
            style={{
              background: isOwn
                ? 'radial-gradient(circle at top right, rgba(255,255,255,0.4), transparent 60%)'
                : `radial-gradient(circle at top left, ${senderTheme.bg}, transparent 60%)`,
            }}
          />

          <div className="relative z-10 space-y-2">
            {/* Image Drop Render */}
            {isImageMessage && (
              <div className="relative group/img overflow-hidden rounded-xl border border-white/10 my-1 bg-black/20">
                <img
                  src={message.imageDataUrl}
                  alt={message.caption || 'Ephemeral drop'}
                  loading="lazy"
                  className="max-h-72 w-auto object-contain rounded-xl cursor-zoom-in transition-transform duration-200 group-hover/img:scale-[1.01]"
                  onClick={() => setIsLightboxOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  aria-label="Enlarge image"
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Markdown Text Render */}
            {message.text && (
              <div className="prose-ink prose-sm text-inherit">
                <ReactMarkdown
                  allowedElements={[
                    'p',
                    'strong',
                    'em',
                    'del',
                    'code',
                    'pre',
                    'blockquote',
                    'a',
                    'span',
                  ]}
                  components={{
                    p: ({ children }) => <p className="m-0 leading-relaxed">{children}</p>,
                    a: ({ href, children }) => {
                      const isSafe =
                        typeof href === 'string' &&
                        (href.startsWith('http://') || href.startsWith('https://'));
                      if (!isSafe) {
                        return <span>{children}</span>;
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="underline underline-offset-2 decoration-current/40 hover:decoration-current transition-colors"
                        >
                          {children}
                        </a>
                      );
                    },
                    code: ({ className, children, ...props }) => {
                      const isInline = !className?.includes('language-');
                      if (isInline) {
                        return (
                          <code
                            className={`px-1.5 py-0.5 rounded text-[12px] font-mono ${
                              isOwn
                                ? 'bg-black/25 text-white'
                                : 'bg-surface-base border border-surface-border text-ink-teal'
                            }`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="my-1.5 p-2.5 rounded-xl bg-surface-base border border-surface-border text-paper-white font-mono text-xs overflow-x-auto">
                          <code className="block" {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-current/40 pl-2.5 my-1 italic opacity-90">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {isLightboxOpen && message.imageDataUrl && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label="Image Preview"
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-ink-drop"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative max-h-[85vh] max-w-[90vw] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={message.imageDataUrl}
              alt={message.caption || 'Ephemeral drop'}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            {message.caption && (
              <p className="mt-3 text-sm text-paper-white text-center font-medium bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                {message.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

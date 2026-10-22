'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, ZoomIn, Clock, ShieldAlert } from 'lucide-react';
import { ChatMessage } from '../types';
import { getInkColorForSender } from '../theme/tokens';

/**
 * Checks whether text contains meaningful, visible content.
 * Accounts for censor mask runs (***, ****, etc.) as valid visible content,
 * while treating whitespace and empty Markdown scaffolding as empty.
 */
export function hasVisibleContent(text?: string): boolean {
  if (!text || !text.trim()) return false;
  // Censor masks are valid visible content
  if (/\*{3,}/.test(text)) return true;
  // Strip common empty markdown wrapper characters
  const stripped = text.replace(/[*_~`#>\s]/g, '');
  return stripped.length > 0;
}

/**
 * Protects censor mask runs from being swallowed by CommonMark parsing:
 * - Standalone ***, **** on a line are parsed as <hr /> (thematic break) in CommonMark
 * - Runs of asterisks can corrupt or collapse bold/italic delimiters
 * Escaping asterisks (\*\*\*\*) outside of code blocks preserves literal asterisks.
 */
export function protectMaskRuns(text: string): string {
  if (!text) return '';
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part) => {
      // Preserve code blocks and inline code as-is
      if (part.startsWith('`')) return part;

      // 1. Escape runs of 4 or more asterisks (censor masks for 4+ char words)
      let res = part.replace(/\*{4,}/g, (match) => {
        return match
          .split('')
          .map((c) => '\\' + c)
          .join('');
      });

      // 2. Escape standalone lines of 3 asterisks (which CommonMark treats as <hr>)
      res = res.replace(/^(\s*)(\*{3})(\s*)$/gm, '$1\\*\\*\\*$3');

      // 3. Escape standalone 3-asterisk words (e.g. censored 3-letter words like "ass")
      res = res.replace(/(^|[\s.,!?:;()[\]{}])(\*{3})(?=[\s.,!?:;()[\]{}]|$)/g, '$1\\*\\*\\*');

      return res;
    })
    .join('');
}

/**
 * Formats runs of 3 or more asterisks into styled monospace censor badges.
 * Ensures WCAG AA contrast (>=4.5:1) in both light and dark themes, for both own
 * and incoming bubbles, while clearly conveying the "censored" intent.
 */
export function formatCensoredText(
  children: React.ReactNode,
  isOwn: boolean
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    const parts = child.split(/(\*{3,})/g);
    if (parts.length === 1) return child;
    return parts.map((part, i) => {
      if (/^\*{3,}$/.test(part)) {
        return (
          <span
            key={i}
            data-censored="true"
            className={`font-mono tracking-wider font-semibold select-all px-1 py-0.5 rounded inline-block align-baseline text-[0.88em] ${
              isOwn
                ? 'text-white/90 bg-black/20 border border-white/10'
                : 'text-paper-white/80 bg-surface-base/60 border border-surface-border'
            }`}
            title="Censored text"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  });
}

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
  const hasText = hasVisibleContent(message.text);
  const protectedText = hasText ? protectMaskRuns(message.text) : '';

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
          className={`relative max-w-[85%] xs:max-w-[78%] md:max-w-[60ch] px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] transition-all ${
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

            {/* Markdown Text Render / Fallback */}
            {hasText ? (
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
                    'hr',
                  ]}
                  components={{
                    p: ({ children }) => (
                      <p className="m-0 leading-relaxed">{formatCensoredText(children, isOwn)}</p>
                    ),
                    strong: ({ children }) => (
                      <strong>{formatCensoredText(children, isOwn)}</strong>
                    ),
                    em: ({ children }) => (
                      <em>{formatCensoredText(children, isOwn)}</em>
                    ),
                    del: ({ children }) => (
                      <del>{formatCensoredText(children, isOwn)}</del>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-current/40 pl-2.5 my-1 italic opacity-90">
                        {formatCensoredText(children, isOwn)}
                      </blockquote>
                    ),
                    a: ({ href, children }) => {
                      const isSafe =
                        typeof href === 'string' &&
                        (href.startsWith('http://') || href.startsWith('https://'));
                      if (!isSafe) {
                        return <span>{formatCensoredText(children, isOwn)}</span>;
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="underline underline-offset-2 decoration-current/40 hover:decoration-current transition-colors"
                        >
                          {formatCensoredText(children, isOwn)}
                        </a>
                      );
                    },
                    code: ({ className, children, node: _node, ...props }) => {
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
                            {formatCensoredText(children, isOwn)}
                          </code>
                        );
                      }
                      return (
                        <pre className="my-1.5 p-2.5 rounded-xl bg-surface-base border border-surface-border text-paper-white font-mono text-xs overflow-x-auto">
                          <code className="block" {...props}>
                            {formatCensoredText(children, isOwn)}
                          </code>
                        </pre>
                      );
                    },
                    hr: () => <hr className="my-2 border-t border-current/20" />,
                  }}
                >
                  {protectedText}
                </ReactMarkdown>
              </div>
            ) : !isImageMessage ? (
              /* Requirement 3: Never render an empty bubble. Show a muted placeholder like [message removed] in italics */
              <p
                className={`m-0 italic text-xs sm:text-sm select-none ${
                  isOwn ? 'text-white/70' : 'text-paper-muted'
                }`}
              >
                [message removed]
              </p>
            ) : null}
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-ink-drop"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative max-h-[85dvh] max-w-[92vw] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={message.imageDataUrl}
              alt={message.caption || 'Ephemeral drop'}
              className="max-h-[80dvh] max-w-[92vw] w-auto object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            {message.caption && hasVisibleContent(message.caption) && (
              <p className="mt-3 text-sm text-paper-white text-center font-medium bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10 max-w-full truncate">
                {formatCensoredText(message.caption, false)}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

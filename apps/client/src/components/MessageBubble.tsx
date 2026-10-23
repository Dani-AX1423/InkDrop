'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { ZoomIn, Clock, ShieldAlert, Copy, Check } from 'lucide-react';
import { ChatMessage } from '../types';
import { getInkColorForSender } from '../theme/tokens';
import { useToast } from './ui/Toast';

const ImageLightbox = dynamic(
  () => import('./ImageLightbox').then((mod) => mod.ImageLightbox),
  { ssr: false }
);

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
                ? 'text-white/95 bg-black/25 border border-white/20'
                : 'text-paper-white bg-surface-base/80 border border-surface-border'
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
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
  onRetry?: (message: ChatMessage) => void;
}

// In-memory cache for rendered Markdown outputs per message ID to eliminate redundant parsing
const markdownCache = new Map<string, React.ReactNode>();

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isGroupStart = true,
  isGroupEnd = true,
  onRetry,
}: MessageBubbleProps) {
  const { toast } = useToast();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyMessageText = () => {
    const textToCopy = message.text || message.caption || '';
    if (textToCopy && typeof window !== 'undefined') {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Mobile long press listener
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      copyMessageText();
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  // System Message Representation
  if (message.isSystem) {
    const isExpire = message.systemType === 'expire';
    const isWarning = message.systemType === 'warning';

    return (
      <div className="flex justify-center my-3 animate-fade-in" role="status">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border backdrop-blur-sm select-none ${
            isExpire
              ? 'border-ink-rose/30 bg-ink-rose/10 text-ink-rose'
              : isWarning
              ? 'border-ink-amber/30 bg-ink-amber/10 text-ink-amber'
              : 'border-surface-border bg-surface-elevated/60 text-paper-muted'
          }`}
        >
          {isExpire && <Clock className="w-3 h-3" strokeWidth={1.5} />}
          {isWarning && <ShieldAlert className="w-3 h-3" strokeWidth={1.5} />}
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

  // Corner radii based on consecutive grouping
  const bubbleCorners = isOwn
    ? isGroupStart && isGroupEnd
      ? 'rounded-2xl rounded-tr-sm'
      : isGroupStart
      ? 'rounded-2xl rounded-tr-sm rounded-br-md'
      : isGroupEnd
      ? 'rounded-2xl rounded-tr-md rounded-br-sm'
      : 'rounded-2xl rounded-tr-md rounded-br-md'
    : isGroupStart && isGroupEnd
    ? 'rounded-2xl rounded-tl-sm'
    : isGroupStart
    ? 'rounded-2xl rounded-tl-sm rounded-bl-md'
    : isGroupEnd
    ? 'rounded-2xl rounded-tl-md rounded-bl-sm'
    : 'rounded-2xl rounded-tl-md rounded-bl-md';

    const cacheKey = `${message.id}:${message.text}:${isOwn}`;
    let markdownContent = markdownCache.get(cacheKey);
    if (!markdownContent && hasText) {
      markdownContent = (
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
      );
      if (markdownCache.size > 300) {
        const oldestKey = markdownCache.keys().next().value;
        if (oldestKey) markdownCache.delete(oldestKey);
      }
      markdownCache.set(cacheKey, markdownContent);
    }

    const isPending = message.status === 'pending';
    const isFailed = message.status === 'failed';

    return (
      <>
        <div
          className={`group relative flex flex-col transition-colors transition-opacity duration-150 animate-fade-in ${
            isOwn ? 'items-end' : 'items-start'
          } ${isGroupStart ? 'mt-3 sm:mt-3.5' : 'mt-1'} ${isPending ? 'opacity-75' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Sender Header only shown at group start */}
          {isGroupStart && (
            <div className="flex items-center gap-2 mb-1 px-1 select-none">
              {!isOwn && (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-teardrop text-[9px] font-bold text-white shadow-sm shrink-0"
                  style={{
                    backgroundColor: senderTheme.color,
                    borderRadius: '50% 50% 50% 0',
                  }}
                  aria-hidden="true"
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

              {/* Monospace Timestamp and Status */}
              <span className="font-mono text-[10px] text-paper-muted opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {isPending ? (
                  <span className="italic text-ink-teal">sending...</span>
                ) : isFailed ? (
                  <span className="text-ink-rose font-sans">failed</span>
                ) : (
                  formatTime(message.timestamp)
                )}
              </span>

              {isFailed && onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="text-[10px] text-ink-rose hover:underline font-mono ml-1 cursor-pointer focus-visible:outline-none"
                >
                  retry
                </button>
              )}
            </div>
          )}

          <div className="relative flex items-center group/bubble max-w-[85%] xs:max-w-[78%] md:max-w-[60ch]">
            {/* Bubble Container */}
            <div
              className={`relative px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] transition-colors ${bubbleCorners} ${
                isOwn
                  ? isFailed
                    ? 'bg-ink-rose/20 text-white border border-ink-rose/40'
                    : 'bg-gradient-to-br from-[#4D4DFF] to-[#3939D4] text-white shadow-sm border border-indigo-400/25'
                  : 'bg-surface-elevated text-paper-white border border-surface-border shadow-sm'
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
                aria-hidden="true"
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
                      <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                )}

                {/* Markdown Text Render / Fallback */}
                {hasText ? (
                  markdownContent
                ) : !isImageMessage ? (
                  /* Requirement: Never render an empty bubble. Show a muted placeholder like [message removed] in italics */
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

            {/* Hover Action: Copy text button */}
            {(hasText || message.caption) && (
              <button
                type="button"
                onClick={copyMessageText}
                aria-label="Copy message text"
                title="Copy message"
                className={`opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-lg border border-surface-border bg-surface-elevated text-paper-muted hover:text-paper-white shadow-sm shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer ${
                  isOwn ? 'order-first mr-1.5' : 'order-last ml-1.5'
                }`}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-ink-teal" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>

          {/* Timestamp on hover for non-group-start messages */}
          {!isGroupStart && (
            <div
              className={`flex items-center gap-1 font-mono text-[9px] text-paper-muted/60 opacity-0 group-hover:opacity-100 transition-opacity px-1 mt-0.5 select-none ${
                isOwn ? 'text-right justify-end' : 'text-left justify-start'
              }`}
            >
              {isPending ? (
                <span className="italic text-ink-teal">sending...</span>
              ) : isFailed ? (
                <>
                  <span className="text-ink-rose">failed</span>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(message)}
                      className="text-ink-rose hover:underline font-mono ml-1 cursor-pointer focus-visible:outline-none"
                    >
                      retry
                    </button>
                  )}
                </>
              ) : (
                formatTime(message.timestamp)
              )}
            </div>
          )}
        </div>

      {/* Fullscreen Image Lightbox Modal (dynamically code-split) */}
      {isLightboxOpen && message.imageDataUrl && (
        <ImageLightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageDataUrl={message.imageDataUrl}
          caption={message.caption}
        />
      )}
    </>
  );
});

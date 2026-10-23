'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  Unlock,
  Copy,
  Check,
  AlertCircle,
  Wind,
  Droplets,
  Clock,
  Share2,
  X,
  UploadCloud,
  MoreVertical,
  ArrowDown,
  Users,
} from 'lucide-react';
import { useSocket } from '../../../hooks/useSocket';
import { MessageBubble } from '../../../components/MessageBubble';
import { SystemLine } from '../../../components/SystemLine';
import { PopulationDots } from '../../../components/PopulationDots';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { PublicRoomInfo, ChatMessage } from '../../../types';
import type { ProcessedImageResult } from '../../../lib/image';
import { playErrorSound } from '../../../lib/audio';
import { useSettings } from '../../../hooks/useSettings';
import { getInkColorForSender } from '../../../theme/tokens';
import { ChatComposer } from '../../../components/ChatComposer';

const PasswordPromptModal = dynamic(
  () => import('../../../components/PasswordPromptModal').then((mod) => mod.PasswordPromptModal),
  { ssr: false }
);

const ShareModal = dynamic(
  () => import('../../../components/ShareModal').then((mod) => mod.ShareModal),
  { ssr: false }
);

export default function DynamicChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id as string;

  const {
    activeRoom,
    messages,
    sendMessage,
    sendImage,
    leaveRoom,
    joinRoom,
    username,
    isRateLimited,
    rateLimitProgress,
    connectionStatus,
    clockSkewMs,
    rooms,
    evaporatedNotice,
    clearEvaporatedNotice,
    retryMessage,
  } = useSocket();
  const { soundEnabled } = useSettings();
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [passwordModalRoom, setPasswordModalRoom] = useState<PublicRoomInfo | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEvaporating, setIsEvaporating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Feed windowing for large message feeds (>100 items)
  const [windowLimit, setWindowLimit] = useState(100);
  const visibleMessages = useMemo(() => {
    if (messages.length <= windowLimit) return messages;
    return messages.slice(messages.length - windowLimit);
  }, [messages, windowLimit]);

  // Unread messages and autoscroll tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const isAutoScrollLocked = useRef<boolean>(true);
  const previousMessageCountRef = useRef<number>(messages.length);

  // Close mobile overflow menu and member list on click outside
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const memberListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }
      if (isMemberListOpen && memberListRef.current && !memberListRef.current.contains(target)) {
        setIsMemberListOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileMenuOpen, isMemberListOpen]);

  // Dynamic mobile visualViewport height handling (prevents keyboard covering composer)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        if (isAutoScrollLocked.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // Pending image drop state for room container
  const [droppedImage, setDroppedImage] = useState<ProcessedImageResult | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // TTL Clock State
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const hasAnnouncedWarningRef = useRef(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-redirect if room evaporated while disconnected
  useEffect(() => {
    if (evaporatedNotice) {
      const timer = setTimeout(() => {
        clearEvaporatedNotice();
        router.push('/');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [evaporatedNotice, clearEvaporatedNotice, router]);

  // Monitor scroll behavior: Anchor to bottom if within 80px threshold, expand window if near top
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    if (el.scrollTop < 60 && windowLimit < messages.length) {
      setWindowLimit((prev) => Math.min(messages.length, prev + 50));
    }

    const threshold = 80;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isAutoScrollLocked.current = isBottom;

    if (isBottom) {
      setUnreadCount(0);
    }
  }, [windowLimit, messages.length]);

  // Auto-scroll on new messages or bump unread count
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      const newMessagesCount = messages.length - previousMessageCountRef.current;
      const lastMsg = messages[messages.length - 1];
      const isFromSelf = lastMsg && !lastMsg.isSystem && lastMsg.sender === username;

      if (isAutoScrollLocked.current || isFromSelf) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setUnreadCount(0);
      } else {
        setUnreadCount((prev) => prev + newMessagesCount);
      }
    }
    previousMessageCountRef.current = messages.length;
  }, [messages, username]);

  // Jump to bottom handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isAutoScrollLocked.current = true;
    setUnreadCount(0);
  };

  // Handle direct navigation / reload
  useEffect(() => {
    if (!roomId || connectionStatus !== 'connected') return;

    if (!activeRoom || activeRoom.id !== roomId) {
      setIsJoining(true);
      setJoinError(null);

      const savedUsername =
        (typeof window !== 'undefined'
          ? localStorage.getItem('inkdrop_username') || localStorage.getItem('inkdrop_alias')
          : null) || username;

      const knownRoom = rooms.find((r) => r.id === roomId);
      if (knownRoom && knownRoom.isPrivate) {
        setPasswordModalRoom(knownRoom);
        setIsJoining(false);
        return;
      }

      joinRoom(roomId, undefined, savedUsername || undefined).then((res) => {
        setIsJoining(false);
        if (!res.success) {
          if (res.error?.toLowerCase().includes('password')) {
            setPasswordModalRoom({
              id: roomId,
              name: knownRoom?.name || 'Locked Pool',
              isPrivate: true,
              userCount: 0,
              createdAt: Date.now(),
            });
          } else {
            setJoinError(res.error || 'Pool has already evaporated.');
          }
        }
      });
    }
  }, [roomId, activeRoom, connectionStatus, joinRoom, rooms, username]);

  // TTL Countdown Timer
  useEffect(() => {
    if (!activeRoom?.expiresAt) {
      setTimeLeftSec(null);
      return;
    }

    const updateTimer = () => {
      const nowSynced = Date.now() + clockSkewMs;
      const remainingMs = activeRoom.expiresAt! - nowSynced;
      const sec = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeftSec(sec);

      if (sec <= 60 && sec > 0 && !hasAnnouncedWarningRef.current) {
        hasAnnouncedWarningRef.current = true;
      }

      if (sec <= 0) {
        setJoinError('This pool has dissolved after reaching its scheduled lifetime.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeRoom?.expiresAt, clockSkewMs]);

  // Format seconds as mm:ss or h:mm:ss
  const formatCountdown = (totalSec: number): string => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleSendMessage = useCallback(
    async (text: string) => {
      await sendMessage(text);
    },
    [sendMessage]
  );

  const handleSendImage = useCallback(
    async (dataUrl: string, caption?: string) => {
      await sendImage(dataUrl, caption);
    },
    [sendImage]
  );

  const handleLeave = () => {
    setIsEvaporating(true);
    setTimeout(() => {
      leaveRoom();
      router.push('/');
    }, 400);
  };

  const handleCopyId = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      toast.success('Pool ID copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Gather online member names from the active pool session
  const onlineMembers = useMemo(() => {
    const memberSet = new Set<string>();
    if (username) memberSet.add(username);

    messages.forEach((msg) => {
      if (msg.sender && msg.sender !== 'SYSTEM') {
        memberSet.add(msg.sender);
      }
    });

    return Array.from(memberSet);
  }, [messages, username]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          try {
            const { processDropImage } = await import('../../../lib/image');
            const res = await processDropImage(file);
            setDroppedImage(res);
          } catch (err: unknown) {
            playErrorSound(soundEnabled);
            const errMsg = err instanceof Error ? err.message : 'Unsupported file or size exceeds 500KB.';
            toast.error(errMsg);
          }
        }
      }
    },
    [soundEnabled, toast]
  );

  // Global paste listener for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            try {
              const { processDropImage } = await import('../../../lib/image');
              const res = await processDropImage(file);
              setDroppedImage(res);
            } catch (err: unknown) {
              playErrorSound(soundEnabled);
              const errMsg = err instanceof Error ? err.message : 'Unsupported file or size exceeds 500KB.';
              toast.error(errMsg);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [soundEnabled, toast]);

  if (isJoining) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
        <div className="relative flex h-12 w-12 items-center justify-center mb-4">
          <span className="absolute h-full w-full rounded-full border border-ink-indigo/40 animate-ping opacity-60" />
          <Droplets className="h-6 w-6 text-ink-indigo animate-bounce" />
        </div>
        <h1 className="font-display text-lg text-paper-white">Entering pool...</h1>
        <span className="font-mono text-xs text-paper-muted mt-1">{roomId}</span>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center animate-fade-in">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-rose/15 text-ink-rose mb-4 border border-ink-rose/30">
          <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-2xl font-medium text-paper-white">
          The pool has evaporated
        </h1>
        <p className="mt-2 max-w-sm text-xs sm:text-sm text-paper-muted">{joinError}</p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push('/')}
          className="mt-6"
        >
          Return to Hub
        </Button>
      </div>
    );
  }

  if (evaporatedNotice) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center animate-fade-in"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-rose/15 text-ink-rose mb-4 border border-ink-rose/30">
          <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-2xl font-medium text-paper-white">
          This pool evaporated while you were away
        </h1>
        <p className="mt-2 max-w-sm text-xs sm:text-sm text-paper-muted">
          {evaporatedNotice} Returning to hub shortly...
        </p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            clearEvaporatedNotice();
            router.push('/');
          }}
          className="mt-6"
        >
          Return to Hub Now
        </Button>
      </div>
    );
  }

  const isUrgentTTL = timeLeftSec !== null && timeLeftSec <= 60;
  const isCappedAt200 = messages.length >= 200;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={viewportHeight ? { height: `${viewportHeight - 68}px` } : undefined}
      className={`ink-container relative flex flex-col h-[calc(100dvh-4.2rem)] py-2 sm:py-3 transition-transform transition-opacity duration-300 ease-out ${
        isEvaporating ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
      }`}
    >
      {/* Centered Chat Column (Max 880px for optimal readability) */}
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-[880px] mx-auto relative">
        {/* Drag & Drop Visual Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 m-2 rounded-2xl border-2 border-dashed border-ink-teal bg-water-deep/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none animate-fade-in">
            <UploadCloud className="w-12 h-12 text-ink-teal animate-bounce mb-3" strokeWidth={1.5} />
            <p className="text-lg font-display font-medium text-paper-white">
              Drop image to diffuse into the pool
            </p>
            <p className="text-xs font-mono text-paper-muted mt-1">
              PNG, JPEG, WebP · Max 500KB · Metadata stripped
            </p>
          </div>
        )}

        {/* Pool Header Bar */}
        <div className="relative flex items-center justify-between rounded-2xl border border-surface-border bg-surface-base/90 px-3.5 sm:px-5 py-3 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-lg xs:text-xl sm:text-2xl font-bold tracking-tight text-paper-white truncate max-w-[150px] xs:max-w-[220px] sm:max-w-md">
                  {activeRoom?.name || 'Ephemeral Pool'}
                </h1>

                {activeRoom?.isPrivate ? (
                  <Badge variant="rose" size="sm" icon={<Lock className="h-3 w-3 text-ink-rose" strokeWidth={1.5} />}>
                    locked
                  </Badge>
                ) : (
                  <Badge variant="teal" size="sm" icon={<Unlock className="h-3 w-3 text-ink-teal" strokeWidth={1.5} />}>
                    open
                  </Badge>
                )}

                {/* TTL Countdown Clock */}
                {timeLeftSec !== null && (
                  <Badge
                    variant={isUrgentTTL ? 'rose' : 'indigo'}
                    size="sm"
                    icon={<Clock className="h-3 w-3" strokeWidth={1.5} />}
                    title="Time until this pool evaporates"
                  >
                    {formatCountdown(timeLeftSec)}
                  </Badge>
                )}
              </div>

              {/* Desktop ID & Action Row */}
              <div className="hidden sm:flex items-center gap-3 mt-1 text-[11px] font-mono text-paper-muted">
                <button
                  onClick={handleCopyId}
                  className="group flex items-center gap-1 hover:text-paper-white transition-colors cursor-pointer"
                  title="Copy pool ID"
                >
                  <span>{roomId}</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-ink-teal" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1 hover:text-ink-teal transition-colors cursor-pointer"
                  title="Share Pool & QR Code"
                >
                  <Share2 className="h-3 w-3" strokeWidth={1.5} />
                  <span>share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Population Dots & Popover Trigger */}
            <div className="relative" ref={memberListRef}>
              <button
                type="button"
                onClick={() => setIsMemberListOpen((prev) => !prev)}
                aria-label={`View occupants (${activeRoom?.userCount ?? 1} in pool)`}
                className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated/80 px-2.5 py-1.5 backdrop-blur-sm hover:border-surface-border-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
              >
                <PopulationDots count={activeRoom?.userCount ?? 1} />
                <span className="hidden sm:inline font-sans text-xs text-paper-muted font-medium">
                  {activeRoom?.userCount ?? 1} in pool
                </span>
              </button>

              {/* Compact Member List Popover */}
              {isMemberListOpen && (
                <div
                  role="dialog"
                  aria-label="Current pool occupants"
                  className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-surface-border bg-surface-elevated/98 p-3 shadow-2xl backdrop-blur-xl animate-fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-surface-border mb-2.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-paper-muted flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-ink-teal" strokeWidth={1.5} />
                      <span>Occupants ({activeRoom?.userCount ?? 1})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMemberListOpen(false)}
                      className="p-1 rounded text-paper-muted hover:text-paper-white"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {onlineMembers.map((member) => {
                      const theme = getInkColorForSender(member);
                      const isMe = member === username;
                      return (
                        <div
                          key={member}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-base/60 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: theme.color }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-paper-white">
                              {member}
                            </span>
                          </div>
                          {isMe && (
                            <span className="text-[10px] text-ink-teal font-sans">
                              (you)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-2.5 pt-2 border-t border-surface-border text-[10px] font-mono text-paper-muted text-center">
                    Volatile presences • Forgotten on exit
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Evaporate / Leave Button */}
            <Button
              variant="danger"
              size="sm"
              onClick={handleLeave}
              className="hidden sm:inline-flex"
              leftIcon={<Wind className="h-3.5 w-3.5" strokeWidth={1.5} />}
            >
              Evaporate
            </Button>

            {/* Mobile Overflow Menu Button */}
            <div className="sm:hidden relative" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label="More actions"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-surface-border bg-surface-elevated/80 text-paper-muted hover:text-paper-white transition-colors"
              >
                <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
              </button>

              {/* Mobile Overflow Menu */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-surface-border bg-surface-base/98 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyId();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-paper-white hover:bg-surface-elevated transition-colors min-h-[44px]"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-ink-teal shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Copy className="h-4 w-4 text-paper-muted shrink-0" strokeWidth={1.5} />
                    )}
                    <span>{copied ? 'Copied ID' : 'Copy Pool ID'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsShareModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-paper-white hover:bg-surface-elevated transition-colors min-h-[44px]"
                  >
                    <Share2 className="h-4 w-4 text-ink-teal shrink-0" strokeWidth={1.5} />
                    <span>Share & QR Code</span>
                  </button>

                  <div className="my-1 border-t border-surface-border/60" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLeave();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-ink-rose hover:bg-ink-rose/10 transition-colors min-h-[44px]"
                  >
                    <Wind className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>Evaporate Pool</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Non-blocking Reconnection Alert */}
        {connectionStatus !== 'connected' && (
          <div
            role="status"
            aria-live="polite"
            className="mt-2 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-ink-amber/15 border border-ink-amber/30 text-xs font-mono text-ink-amber"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ink-amber animate-pulse" />
            <span>
              {connectionStatus === 'reconnecting'
                ? 'Connection lost. Reconnecting to pool…'
                : connectionStatus === 'waking'
                ? 'Server is waking… reconnecting shortly.'
                : connectionStatus === 'offline'
                ? 'Server offline. Attempting to reach pool…'
                : 'Connecting to server…'}
            </span>
          </div>
        )}

        {/* 60-Second Evaporation Warning */}
        {isUrgentTTL && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-ink-rose/15 border border-ink-rose/30 text-xs font-mono text-ink-rose"
          >
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Warning: This pool will evaporate in under 60 seconds.</span>
          </div>
        )}

        {/* Live Chat Feed Canvas */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label="Pool messages feed"
          className="my-3 flex-1 overflow-y-auto px-2 sm:px-4 py-2"
        >
          {/* Top In-Memory Cap Notice */}
          {isCappedAt200 && (
            <div className="flex items-center justify-center my-3 select-none">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-paper-muted border border-surface-border bg-surface-elevated/50 backdrop-blur-sm">
                <Droplets className="w-3 h-3 text-ink-teal" strokeWidth={1.5} />
                <span>Older messages have evaporated from volatile memory</span>
              </span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
              <div className="relative w-16 h-16 mb-4" aria-hidden="true">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible pointer-events-none">
                  <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-indigo/30 animate-empty-water-1" />
                  <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-teal/20 animate-empty-water-2" />
                  <circle cx="50" cy="50" r="2" className="fill-ink-indigo/60" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-normal text-paper-white">
                The water is quiet.
              </h2>
              <p className="mt-1.5 font-sans text-xs text-paper-muted max-w-xs leading-relaxed">
                Drop markdown words or drag an image into the pool. It lives only while the pool exists.
              </p>
            </div>
          ) : (
            <div>
              {visibleMessages.length < messages.length && (
                <div className="flex items-center justify-center my-2 select-none">
                  <button
                    type="button"
                    onClick={() => setWindowLimit((prev) => Math.min(messages.length, prev + 50))}
                    className="font-mono text-[10px] text-paper-muted hover:text-ink-teal underline cursor-pointer"
                  >
                    Load {messages.length - visibleMessages.length} earlier drops
                  </button>
                </div>
              )}
              {visibleMessages.map((msg, idx) => {
                if (msg.isSystem) {
                  return <SystemLine key={msg.id} message={msg} />;
                }

                const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
                const nextMsg = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;

                const isFiveMinGap =
                  Boolean(prevMsg && !prevMsg.isSystem && msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000);

                const isGroupStart =
                  !prevMsg ||
                  prevMsg.isSystem ||
                  prevMsg.sender !== msg.sender ||
                  isFiveMinGap;

                const isGroupEnd =
                  !nextMsg ||
                  nextMsg.isSystem ||
                  nextMsg.sender !== msg.sender ||
                  (nextMsg.timestamp - msg.timestamp > 5 * 60 * 1000);

                const isOwn = msg.sender === username;

                return (
                  <React.Fragment key={msg.id}>
                    {/* Centered time divider after 5+ minute gap */}
                    {isFiveMinGap && (
                      <div className="flex items-center justify-center my-4 select-none" aria-hidden="true">
                        <span className="h-px bg-surface-border/60 flex-1 max-w-[60px]" />
                        <span className="mx-3 font-mono text-[10px] text-paper-muted tracking-wider">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="h-px bg-surface-border/60 flex-1 max-w-[60px]" />
                      </div>
                    )}

                    <MessageBubble
                      message={msg}
                      isOwn={isOwn}
                      isGroupStart={isGroupStart}
                      isGroupEnd={isGroupEnd}
                      onRetry={retryMessage}
                    />
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating "New messages" Jump Button with Unread Count */}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ink-indigo text-white font-mono text-xs shadow-xl hover:bg-[#4D4DEB] active:scale-95 transition-colors duration-150 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowDown className="h-3.5 w-3.5 animate-bounce" strokeWidth={1.5} />
            <span>
              {unreadCount} new {unreadCount === 1 ? 'drop' : 'drops'}
            </span>
          </button>
        )}

        {/* Isolated Chat Composer (typing will NOT re-render message feed or room page) */}
        <ChatComposer
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          connectionStatus={connectionStatus}
          isRateLimited={isRateLimited}
          rateLimitProgress={rateLimitProgress}
          externalImage={droppedImage}
          onClearExternalImage={() => setDroppedImage(null)}
        />
      </div>

      {/* Password Prompt Modal for Direct Navigation */}
      <PasswordPromptModal
        room={passwordModalRoom}
        onClose={() => {
          setPasswordModalRoom(null);
          if (!activeRoom) router.push('/');
        }}
      />

      {/* Share Pool Modal */}
      {activeRoom && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          isPrivate={activeRoom.isPrivate}
          expiresAt={activeRoom.expiresAt}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  Unlock,
  Send,
  Copy,
  Check,
  AlertCircle,
  Wind,
  Droplets,
  Clock,
  Share2,
  Image as ImageIcon,
  X,
  UploadCloud,
  MoreVertical,
} from 'lucide-react';
import { useSocket } from '../../../hooks/useSocket';
import { PasswordPromptModal } from '../../../components/PasswordPromptModal';
import { ShareModal } from '../../../components/ShareModal';
import { MessageBubble } from '../../../components/MessageBubble';
import { SystemLine } from '../../../components/SystemLine';
import { PopulationDots } from '../../../components/PopulationDots';
import { PublicRoomInfo } from '../../../types';
import { processDropImage, ProcessedImageResult } from '../../../lib/image';
import { playErrorSound } from '../../../lib/audio';
import { useSettings } from '../../../hooks/useSettings';

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
  } = useSocket();
  const { soundEnabled } = useSettings();

  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [passwordModalRoom, setPasswordModalRoom] = useState<PublicRoomInfo | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEvaporating, setIsEvaporating] = useState(false);
  const [sendSquirt, setSendSquirt] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Close mobile menu on click outside
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Dynamic mobile visualViewport height handling (prevents keyboard from covering input)
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

  // Pending image drop state
  const [pendingImage, setPendingImage] = useState<ProcessedImageResult | null>(null);
  const [imageProcessingError, setImageProcessingError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // TTL Clock State
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const hasAnnouncedWarningRef = useRef(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAutoScrollLocked = useRef<boolean>(true);

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

  // Monitor scroll behavior: Anchor to bottom unless manually scrolled up
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const threshold = 60;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isAutoScrollLocked.current = isBottom;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isAutoScrollLocked.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

      // Warning when < 60s
      if (sec <= 60 && sec > 0 && !hasAnnouncedWarningRef.current) {
        hasAnnouncedWarningRef.current = true;
      }

      // Expired
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

  // Process dropped or pasted image
  const handleIncomingFile = useCallback(
    async (file: File) => {
      setImageProcessingError(null);
      try {
        const processed = await processDropImage(file);
        setPendingImage(processed);
      } catch (err) {
        playErrorSound(soundEnabled);
        const msg = err instanceof Error ? err.message : 'Failed processing image';
        setImageProcessingError(msg);
        setTimeout(() => setImageProcessingError(null), 4000);
      }
    },
    [soundEnabled]
  );

  // Drag and drop listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        await handleIncomingFile(file);
      }
    }
  };

  // Global paste listener for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleIncomingFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleIncomingFile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRateLimited || connectionStatus !== 'connected') return;

    if (pendingImage) {
      const caption = inputText.trim();
      const dataUrl = pendingImage.dataUrl;
      setPendingImage(null);
      setInputText('');
      setSendSquirt(true);
      setTimeout(() => setSendSquirt(false), 500);

      await sendImage(dataUrl, caption || undefined);
      inputRef.current?.focus();
      return;
    }

    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    setSendSquirt(true);
    setTimeout(() => setSendSquirt(false), 500);

    await sendMessage(text);
    inputRef.current?.focus();
  };

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
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isJoining) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
        <div className="relative flex h-12 w-12 items-center justify-center mb-4">
          <span className="absolute h-full w-full rounded-full border border-ink-indigo/40 animate-ping opacity-60" />
          <Droplets className="h-6 w-6 text-ink-indigo animate-bounce" />
        </div>
        <p className="font-display text-lg text-paper-white">Entering pool...</p>
        <span className="font-mono text-xs text-paper-muted mt-1">{roomId}</span>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center animate-ink-drop">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-rose/15 text-ink-rose mb-4 border border-ink-rose/30">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-medium text-paper-white">
          The pool has evaporated
        </h2>
        <p className="mt-2 max-w-sm text-xs sm:text-sm text-paper-muted">{joinError}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 rounded-full bg-surface-elevated border border-surface-border px-5 py-2 text-xs font-mono text-paper-white hover:border-surface-border-hover transition-colors shadow-sm"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  if (evaporatedNotice) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center animate-ink-drop"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-rose/15 text-ink-rose mb-4 border border-ink-rose/30">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-medium text-paper-white">
          This pool evaporated while you were away
        </h2>
        <p className="mt-2 max-w-sm text-xs sm:text-sm text-paper-muted">
          {evaporatedNotice} Returning to hub shortly...
        </p>
        <button
          onClick={() => {
            clearEvaporatedNotice();
            router.push('/');
          }}
          className="mt-6 rounded-full bg-surface-elevated border border-surface-border px-5 py-2 text-xs font-mono text-paper-white hover:border-surface-border-hover transition-colors shadow-sm"
        >
          Return to Hub Now
        </button>
      </div>
    );
  }

  const isUrgentTTL = timeLeftSec !== null && timeLeftSec <= 60;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={viewportHeight ? { height: `${viewportHeight - 68}px` } : undefined}
      className={`ink-container relative flex flex-col h-[calc(100dvh-4.2rem)] py-2 sm:py-3 transition-all duration-400 ${
        isEvaporating ? 'opacity-0 scale-95 blur-sm -translate-y-4' : 'opacity-100 scale-100 blur-0'
      }`}
    >
      {/* Centered Chat Column (Max ~880px on Wide & Ultrawide) */}
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-[880px] mx-auto">
        {/* Drag & Drop Visual Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 m-3 rounded-[28px] border-2 border-dashed border-ink-teal bg-water-deep/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none animate-ink-drop">
            <UploadCloud className="w-12 h-12 text-ink-teal animate-bounce mb-3" />
            <p className="text-lg font-serif font-medium text-paper-white">
              Drop image to diffuse into the pool
            </p>
            <p className="text-xs font-mono text-paper-muted mt-1">
              PNG, JPEG, WebP · Max 500KB · Strips metadata
            </p>
          </div>
        )}

        {/* Pool Header Bar */}
        <div className="relative flex items-center justify-between rounded-2xl border border-surface-border bg-surface-base/85 px-3.5 sm:px-5 py-3 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-lg xs:text-xl sm:text-2xl font-bold tracking-tight text-paper-white truncate max-w-[150px] xs:max-w-[220px] sm:max-w-md">
                  {activeRoom?.name || 'Ephemeral Pool'}
                </h1>

                {activeRoom?.isPrivate ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-ink-rose/30 bg-ink-rose/10 px-2 py-0.5 text-[10px] font-mono text-ink-rose shrink-0">
                    <Lock className="h-2.5 w-2.5" strokeWidth={1.5} />
                    <span>locked</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-ink-teal/30 bg-ink-teal/10 px-2 py-0.5 text-[10px] font-mono text-ink-teal shrink-0">
                    <Unlock className="h-2.5 w-2.5" strokeWidth={1.5} />
                    <span>open</span>
                  </span>
                )}

                {/* TTL Countdown Clock */}
                {timeLeftSec !== null && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono border transition-all shrink-0 ${
                      isUrgentTTL
                        ? 'border-ink-rose bg-ink-rose/20 text-ink-rose font-bold'
                        : 'border-ink-indigo/40 bg-ink-indigo/10 text-paper-white'
                    }`}
                    title="Time until this room evaporates"
                  >
                    <Clock className="h-3 w-3" strokeWidth={1.5} />
                    <span>{formatCountdown(timeLeftSec)}</span>
                  </span>
                )}
              </div>

              {/* Desktop ID & Action Row */}
              <div className="hidden sm:flex items-center gap-3 mt-1 text-[11px] font-mono text-paper-muted">
                <button
                  onClick={handleCopyId}
                  className="group flex items-center gap-1 hover:text-paper-white transition-colors"
                  title="Copy pool ID"
                >
                  <span>{roomId}</span>
                  {copied ? (
                    <Check className="h-2.5 w-2.5 text-ink-teal" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1 hover:text-ink-teal transition-colors"
                  title="Share Pool & QR Code"
                >
                  <Share2 className="h-2.5 w-2.5" strokeWidth={1.5} />
                  <span>share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Population Dots */}
            <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-elevated/70 px-2.5 py-1.5 backdrop-blur-sm">
              <PopulationDots count={activeRoom?.userCount ?? 1} />
              <span className="hidden sm:inline font-sans text-xs text-paper-muted">
                {activeRoom?.userCount ?? 1} in pool
              </span>
            </div>

            {/* Desktop Evaporate / Leave Button */}
            <button
              onClick={handleLeave}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-elevated/60 px-3 py-1.5 text-xs text-paper-muted hover:text-ink-rose hover:border-ink-rose/30 hover:bg-ink-rose/10 active:scale-95 transition-all select-none"
              title="Evaporate presence and exit"
            >
              <Wind className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Evaporate</span>
            </button>

            {/* Mobile Overflow "More" Button */}
            <div className="sm:hidden relative" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label="More actions"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-surface-border bg-surface-elevated/80 text-paper-muted hover:text-paper-white transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Mobile Overflow Dropdown Menu */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-surface-border bg-surface-base/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in text-xs font-mono">
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
                    <span>{copied ? 'Copied ID!' : 'Copy Pool ID'}</span>
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

      {/* Non-blocking Reconnection State Alert */}
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

      {/* 60-Second Evaporation Alert Banner */}
      {isUrgentTTL && (
        <div className="mt-2 flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-ink-rose/15 border border-ink-rose/30 text-xs font-mono text-ink-rose">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Warning: This pool will evaporate in under 60 seconds.</span>
        </div>
      )}

      {/* Live Chat Canvas (Ambient ink-water background shows through) */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="my-3 flex-1 overflow-y-auto px-2 sm:px-4 py-2"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 select-none">
            <div className="relative w-16 h-16 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible pointer-events-none">
                <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-indigo/30 animate-empty-water-1" />
                <circle cx="50" cy="50" r="36" fill="none" className="stroke-ink-teal/20 animate-empty-water-2" />
                <circle cx="50" cy="50" r="2" className="fill-ink-indigo/60" />
              </svg>
            </div>
            <p className="font-display text-2xl font-normal text-paper-white">
              The water is quiet.
            </p>
            <p className="mt-1.5 font-sans text-xs text-paper-muted max-w-xs leading-relaxed">
              Drop markdown text or drag an image into the pool. It lives only while the pool exists.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => {
              if (msg.isSystem) {
                return <SystemLine key={msg.id} message={msg} />;
              }
              const isOwn = msg.sender === username;
              return (
                <MessageBubble key={msg.id} message={msg} isOwn={isOwn} />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error alert for image processing */}
      {imageProcessingError && (
        <div className="mb-2 p-2 rounded-xl bg-ink-rose/15 border border-ink-rose/30 text-xs text-ink-rose flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{imageProcessingError}</span>
        </div>
      )}

      {/* Bottom Input Bar with Deliberate 14px Radii */}
      <div className="relative mb-2">
        {/* Pending Image Chip Preview */}
        {pendingImage && (
          <div className="mb-2 inline-flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-surface-elevated border border-surface-border shadow-lg animate-ink-drop">
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
              className="ml-2 p-1 rounded-md text-paper-muted hover:text-paper-white hover:bg-surface-base transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated/95 p-1.5 shadow-sm backdrop-blur-md">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* Hidden file input for image uploads */}
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-paper-muted hover:text-ink-teal hover:bg-surface-base transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
              }}
              disabled={isRateLimited}
              placeholder={
                isRateLimited
                  ? 'Waves settling...'
                  : pendingImage
                  ? 'Add an optional image caption...'
                  : 'Drop words into the dark water...'
              }
              maxLength={1000}
              className={`flex-1 bg-transparent px-3 py-2 text-base sm:text-sm text-paper-white placeholder-paper-faint focus:outline-none transition-all ${
                isRateLimited ? 'opacity-40 italic cursor-not-allowed' : 'opacity-100'
              }`}
            />

            {/* Ink-Drop Send Button with Flat Indigo & Inner Highlight */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !pendingImage) || isRateLimited || connectionStatus !== 'connected'}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-ink-indigo text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#4D4DEB] active:scale-95 shrink-0"
              title={
                connectionStatus !== 'connected'
                  ? 'Connecting to server...'
                  : isRateLimited
                  ? 'Rate limited'
                  : 'Send ink drop'
              }
            >
              <Send className="h-4 w-4 -translate-y-px translate-x-px" strokeWidth={1.5} />
            </button>
          </form>

          {/* Rate-Limit State: Ink Drying Progress Line */}
          {isRateLimited && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ink-rose via-ink-amber to-ink-rose transition-all ease-linear"
                style={{ width: `${rateLimitProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
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

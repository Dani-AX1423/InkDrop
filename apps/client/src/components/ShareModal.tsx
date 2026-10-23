'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, Share2, Clock, ShieldAlert } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

// Lazy-load QRCodeSVG dynamically
const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="w-[180px] h-[180px] rounded-xl bg-surface-elevated animate-pulse flex items-center justify-center text-paper-muted text-xs font-mono">
        Generating QR...
      </div>
    ),
  }
);

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  isPrivate: boolean;
  expiresAt?: number;
}

export function ShareModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  isPrivate,
  expiresAt,
}: ShareModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/room/${roomId}`);
    }
  }, [roomId]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Pool link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `InkDrop: ${roomName}`,
          text: `Join the ephemeral pool "${roomName}" on InkDrop:`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Pool"
      subtitle={roomName}
      accent="teal"
    >
      <div className="space-y-5">
        {/* Warning regarding expiration / emptiness */}
        <div className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-base/70 p-3.5 text-xs text-paper-muted leading-relaxed">
          <Clock className="w-4 h-4 text-ink-teal shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span className="font-medium text-paper-white">Ephemeral link</span>
            <p className="mt-0.5 text-[11px]">
              This link is only valid while the pool has occupants or until its TTL expires.
              {isPrivate && ' Visitors will require the secret passcode to enter.'}
            </p>
          </div>
        </div>

        {/* QR Code Container (Dark water card on light background) */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-surface-border bg-white p-5 shadow-inner">
          <QRCodeSVG
            value={shareUrl || `https://inkdrop.vercel.app/room/${roomId}`}
            size={180}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#05070C"
            includeMargin={false}
          />
          <span className="mt-3 font-mono text-[11px] text-neutral-600 tracking-wider">
            Scan to enter pool instantly
          </span>
        </div>

        {/* Link input & Copy Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full h-11 rounded-xl border border-surface-border bg-surface-base/80 px-3.5 text-xs font-mono text-paper-white focus:outline-none select-all"
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            leftIcon={
              copied ? (
                <Check className="h-4 w-4 text-ink-teal" strokeWidth={1.5} />
              ) : (
                <Copy className="h-4 w-4" strokeWidth={1.5} />
              )
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleNativeShare}
              leftIcon={<Share2 className="h-4 w-4" strokeWidth={1.5} />}
            >
              Share
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

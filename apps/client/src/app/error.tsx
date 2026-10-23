'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { DropLogo } from '../components/DropLogo';
import { Button } from '../components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('⚠️ [InkDrop Runtime Error Boundary]:', error.message || error);
  }, [error]);

  return (
    <div className="ink-container min-h-[75dvh] flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-ink-rose/20 blur-xl animate-pulse" aria-hidden="true" />
        <DropLogo size={56} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-ink-rose/10 text-ink-rose border border-ink-rose/20 mb-4 select-none">
        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
        Surface Disturbance
      </span>

      <h1 className="font-display text-fluid-h1 font-bold tracking-tight text-paper-white mb-3 text-balance">
        Unexpected Turbulence
      </h1>

      <p className="max-w-[48ch] text-fluid-body text-paper-muted mb-8 leading-relaxed text-pretty">
        An unexpected error occurred while rendering the volatile interface. Your session state
        remains isolated and no disk was written.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={() => reset()}
          leftIcon={<RefreshCw className="w-4 h-4" strokeWidth={1.5} />}
        >
          Try Again
        </Button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-paper-white bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border transition-colors duration-150 active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>Back to Lobby</span>
        </Link>
      </div>
    </div>
  );
}

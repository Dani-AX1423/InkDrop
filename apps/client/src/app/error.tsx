'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { DropLogo } from '../components/DropLogo';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected runtime exception for diagnostics without user payload
    console.error('⚠️ [InkDrop Runtime Error Boundary]:', error.message || error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
        <DropLogo size={56} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
        <AlertTriangle className="w-3.5 h-3.5" />
        Unexpected Turbulence
      </span>

      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-paper-white mb-3">
        Surface Disturbance
      </h1>

      <p className="max-w-md text-sm sm:text-base text-paper-muted mb-8 leading-relaxed">
        An unexpected error occurred while rendering the volatile interface. Your session state
        remains isolated and no disk was written.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-paper-white bg-ink-indigo hover:bg-ink-indigo/90 transition-all duration-200 active:scale-95 shadow-lg shadow-ink-indigo/20"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-paper-white/80 hover:text-paper-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lobby
        </Link>
      </div>
    </div>
  );
}

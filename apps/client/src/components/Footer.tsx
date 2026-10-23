'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Shield, HelpCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-surface-border bg-surface-base/40 backdrop-blur-sm transition-colors py-6 text-xs text-paper-muted">
      <div className="ink-container flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left identity & volatile guarantee */}
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-teal" aria-hidden="true" />
          <span className="font-mono text-[11px] text-paper-muted">
            InkDrop · Volatile memory only · No disk written
          </span>
        </div>

        {/* Right navigational & issue links */}
        <nav aria-label="Footer Navigation" className="flex items-center gap-4 sm:gap-6 font-medium">
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 hover:text-paper-white transition-colors min-h-[36px] py-1"
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>How it works</span>
          </Link>

          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 hover:text-paper-white transition-colors min-h-[36px] py-1"
          >
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Privacy</span>
          </Link>

          <a
            href="https://github.com/daniel-f/inkdrop/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-paper-white transition-colors min-h-[36px] py-1"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Report an issue</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}

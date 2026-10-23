import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Droplets, ShieldCheck, Zap, Clock, Terminal } from 'lucide-react';
import { DropLogo } from '../../components/DropLogo';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Learn how InkDrop operates: volatile memory storage, zero-disk writes, synchronous content scrubbing, and automatic evaporation.',
};

export default function AboutPage() {
  return (
    <div className="ink-container py-8 sm:py-12 md:py-16 max-w-3xl mx-auto">
      {/* Return link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-mono text-paper-muted hover:text-paper-white transition-colors mb-8 min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        <span>Return to Lobby</span>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <DropLogo size={32} />
        <span className="font-mono text-xs text-ink-teal px-2 py-0.5 rounded border border-ink-teal/30 bg-ink-teal/10">
          Zero Disk Architecture
        </span>
      </div>

      <h1 className="font-display text-fluid-h1 font-bold text-paper-white tracking-tight mb-4 text-balance">
        Drop ink in dark water. Watch it evaporate.
      </h1>

      <p className="text-fluid-body text-paper-muted font-body leading-relaxed mb-10 text-pretty">
        InkDrop is an ephemeral, multi-room communication platform engineered around one core principle:
        data should only exist while someone is actively listening. When the conversation ends, the memory dissolves completely.
      </p>

      {/* Core Architectural Pillars */}
      <div className="space-y-8 border-t border-surface-border pt-8">
        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-indigo/15 border border-ink-indigo/30 text-ink-indigo">
              <Zap className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>1. Volatile In-Memory Engine</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            Every room, message, and image resides exclusively in volatile application memory (RAM and in-memory Redis keys). Nothing is ever committed to a database, solid-state drive, or persistent block storage.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-rose/15 border border-ink-rose/30 text-ink-rose">
              <Droplets className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>2. The Evaporation Protocol</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            Pools do not persist indefinitely. A pool evaporates under two conditions:
          </p>
          <ul className="text-sm text-paper-muted space-y-2 list-disc pl-14">
            <li>
              <strong className="text-paper-white font-medium">Last person leaves:</strong> An atomic eviction decrements the occupant counter; the moment it hits zero, the pool key and all in-flight buffers are purged instantly.
            </li>
            <li>
              <strong className="text-paper-white font-medium">Scheduled TTL expires:</strong> When a pool reaches its preset lifetime (5 minutes, 15 minutes, or 1 hour), an eviction routine dissolves the room regardless of active occupants.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-teal/15 border border-ink-teal/30 text-ink-teal">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>3. Client-Side Image Stripping & Hashing</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            Images uploaded to InkDrop are re-encoded directly in your browser. EXIF metadata (GPS coordinates, device model, camera settings) is stripped before bytes leave your machine. Images are capped at 500KB and throttled to prevent spam.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-amber/15 border border-ink-amber/30 text-ink-amber">
              <Clock className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>4. Rate Limiting & Moderation</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            A synchronized sliding-window algorithm limits users to 5 messages per 2-second burst window. Profanity is masked synchronously via a Trie filter before WebSocket fan-out, preserving context without persistent blacklists.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-surface-elevated border border-surface-border text-paper-white">
              <Terminal className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>5. Zero Tracking, Zero Cookies</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            No analytics, tracking pixels, or marketing beacons exist in the codebase. Your selected alias and settings live solely in your browser&apos;s localStorage for your own convenience and never cross the wire for identity profiling.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-surface-border flex justify-start">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-ink-indigo hover:bg-[#4D4DEB] transition-colors transition-transform duration-150 ease-out active:scale-95 shadow-md min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          <span>Enter the Pools</span>
        </Link>
      </div>
    </div>
  );
}

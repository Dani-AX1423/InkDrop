import Link from 'next/link';
import { ArrowLeft, Waves } from 'lucide-react';
import { DropLogo } from '../components/DropLogo';

export default function NotFound() {
  return (
    <div className="ink-container min-h-[75dvh] flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-ink-indigo/20 blur-xl animate-pulse" aria-hidden="true" />
        <DropLogo size={56} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-ink-indigo/10 text-ink-indigo border border-ink-indigo/20 mb-4 select-none">
        <Waves className="w-3.5 h-3.5" strokeWidth={1.5} />
        Error 404 • Dissolved
      </span>

      <h1 className="font-display text-fluid-h1 font-bold tracking-tight text-paper-white mb-3 text-balance">
        Pool Evaporated
      </h1>

      <p className="max-w-[48ch] text-fluid-body text-paper-muted mb-8 leading-relaxed text-pretty">
        The drop you were looking for has completely dissolved into dark water,
        reached its scheduled expiration, or never existed in memory.
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-ink-indigo hover:bg-[#4D4DEB] transition-colors transition-transform duration-150 ease-out active:scale-95 shadow-lg shadow-ink-indigo/15 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-water-deep"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        <span>Return to Lobby</span>
      </Link>
    </div>
  );
}

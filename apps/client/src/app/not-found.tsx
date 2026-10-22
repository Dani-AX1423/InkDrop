import Link from 'next/link';
import { ArrowLeft, Waves } from 'lucide-react';
import { DropLogo } from '../components/DropLogo';

export default function NotFound() {
  return (
    <div className="ink-container min-h-[75dvh] flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-ink-indigo/20 blur-xl animate-pulse" />
        <DropLogo size={56} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-ink-indigo/10 text-ink-indigo border border-ink-indigo/20 mb-4">
        <Waves className="w-3.5 h-3.5" />
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-paper-white bg-ink-indigo/20 hover:bg-ink-indigo/30 border border-ink-indigo/40 hover:border-ink-indigo transition-all duration-200 active:scale-95 shadow-lg shadow-ink-indigo/10 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Lobby
      </Link>
    </div>
  );
}

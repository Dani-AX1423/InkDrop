import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Trash2 } from 'lucide-react';
import { DropLogo } from '../../components/DropLogo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Our zero-disk privacy pledge: no tracking, no analytics, no accounts, and no persistent database logs.',
};

export default function PrivacyPage() {
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
        <span className="font-mono text-xs text-ink-indigo px-2 py-0.5 rounded border border-ink-indigo/30 bg-ink-indigo/10">
          Privacy Pledge
        </span>
      </div>

      <h1 className="font-display text-fluid-h1 font-bold text-paper-white tracking-tight mb-4 text-balance">
        Zero Disk. Zero Logs. Pure Volatile Memory.
      </h1>

      <p className="text-fluid-body text-paper-muted font-body leading-relaxed mb-10 text-pretty">
        Most privacy policies explain all the data companies collect from you. Ours explains why we collect nothing at all.
      </p>

      {/* Direct, Honest Breakdown */}
      <div className="space-y-8 border-t border-surface-border pt-8">
        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-indigo/15 border border-ink-indigo/30 text-ink-indigo">
              <EyeOff className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>What We Do NOT Collect</h2>
          </div>
          <ul className="text-sm text-paper-muted space-y-2 list-disc pl-14 leading-relaxed">
            <li><strong className="text-paper-white font-medium">No accounts:</strong> You never register, log in, or give us an email address.</li>
            <li><strong className="text-paper-white font-medium">No tracking or analytics:</strong> No Google Analytics, no telemetry, no heatmaps, no Facebook pixels.</li>
            <li><strong className="text-paper-white font-medium">No persistent IP logs:</strong> IP addresses are used purely in volatile memory to calculate the 2-second rate-limiting window and are never written to disk.</li>
            <li><strong className="text-paper-white font-medium">No disk storage:</strong> Messages and images do not touch persistent hard drives or cloud object storage (S3/GCS).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-rose/15 border border-ink-rose/30 text-ink-rose">
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>How Messages & Images Are Treated</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            When you send a message or drop an image into a pool, it is broadcast in real time across the room’s active WebSocket subscribers. It lives in the server’s volatile RAM buffer (capped at the last 200 items). The moment the last participant exits or the room reaches its expiration timer, the entire buffer is permanently erased from memory.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-teal/15 border border-ink-teal/30 text-ink-teal">
              <Lock className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>Private Pool Passcodes</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            When you lock a pool with a passcode, it is hashed with a cryptographic salt and stored in volatile memory. It is never logged in plaintext. When the room evaporates, the hash evaporates with it.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2.5 text-paper-white font-display text-lg font-bold">
            <div className="p-1.5 rounded-lg bg-ink-amber/15 border border-ink-amber/30 text-ink-amber">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <h2>Local Browser Storage</h2>
          </div>
          <p className="text-sm text-paper-muted leading-relaxed pl-8">
            We store non-identifying preferences in your browser’s localStorage: your chosen nickname, sound volume, dark/light theme choice, and whether you dismissed the first-time welcome hint. These never leave your device.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-surface-border flex justify-start">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs text-white bg-ink-indigo hover:bg-[#4D4DEB] transition-colors transition-transform duration-150 ease-out active:scale-95 shadow-md min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          <span>Return to Lobby</span>
        </Link>
      </div>
    </div>
  );
}

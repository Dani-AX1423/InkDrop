import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { Bricolage_Grotesque, Hanken_Grotesk, Martian_Mono } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '../context/SocketContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { RateLimitToast } from '../components/RateLimitToast';
import { InkBackground } from '../components/InkBackground';
import { ToastProvider } from '../components/ui/Toast';

// Lazy-load cursor glow after first paint
const PageCursorGlow = dynamic(
  () => import('../components/PageCursorGlow').then((mod) => mod.PageCursorGlow),
  { ssr: false }
);

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const martianMono = Martian_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL ||
  'http://localhost:4000';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#05070C' },
    { media: '(prefers-color-scheme: light)', color: '#F4F6F9' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://inkdrop.vercel.app'),
  title: {
    default: 'InkDrop — Ephemeral Real-Time Pools',
    template: '%s | InkDrop',
  },
  description:
    'Anonymous, ephemeral real-time communication pools living purely in volatile memory. Drop ink into dark water; watch it evaporate.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icon.svg' }],
  },
  openGraph: {
    title: 'InkDrop — Ephemeral Real-Time Pools',
    description:
      'Anonymous, ephemeral real-time communication pools living purely in volatile memory. Zero disk, pure memory.',
    siteName: 'InkDrop',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'InkDrop — Ephemeral Real-Time Pools',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InkDrop — Ephemeral Real-Time Pools',
    description:
      'Anonymous, ephemeral real-time communication pools living purely in volatile memory.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${martianMono.variable}`}
    >
      <head>
        <link rel="preconnect" href={SERVER_URL} />
        <link rel="dns-prefetch" href={SERVER_URL} />
      </head>
      <body className="min-h-[100dvh] bg-water-deep text-paper-white font-body antialiased selection:bg-ink-indigo/35 selection:text-paper-white text-[15px] leading-[1.55]">
        {/* Skip to Content accessible navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[200] px-4 py-2.5 bg-ink-indigo text-white rounded-xl font-mono text-xs font-medium shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <SocketProvider>
              <InkBackground />
              <PageCursorGlow />
              <div className="relative z-10 flex min-h-[100dvh] flex-col">
                <Header />
                <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col outline-none">
                  {children}
                </main>
                <Footer />
                <RateLimitToast />
              </div>
            </SocketProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

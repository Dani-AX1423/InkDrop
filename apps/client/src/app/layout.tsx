import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk, Martian_Mono } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '../context/SocketContext';
import { ThemeProvider } from '../components/ThemeProvider';
import { Header } from '../components/Header';
import { RateLimitToast } from '../components/RateLimitToast';
import { InkBackground } from '../components/InkBackground';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  variable: '--font-display',
  display: 'swap',
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const martianMono = Martian_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#05070c' },
    { media: '(prefers-color-scheme: light)', color: '#fafbfd' },
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
      <body className="min-h-screen bg-water-deep text-paper-white font-body antialiased selection:bg-ink-indigo/35 selection:text-paper-white text-[15px] leading-[1.55]">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SocketProvider>
            <InkBackground />
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <RateLimitToast />
            </div>
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

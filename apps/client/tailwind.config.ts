import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/context/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        water: {
          deep: 'var(--water-deep)',
          shallow: 'var(--water-shallow)',
          mist: '#131A2B',
        },
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          card: 'var(--surface-card)',
          border: 'var(--surface-border)',
          'border-hover': 'var(--surface-border-hover)',
        },
        ink: {
          indigo: '#5B5BFF',
          'indigo-soft': 'rgba(91, 91, 255, 0.15)',
          'indigo-glow': 'rgba(91, 91, 255, 0.35)',
          teal: '#2DD4BF',
          'teal-soft': 'rgba(45, 212, 191, 0.15)',
          'teal-glow': 'rgba(45, 212, 191, 0.35)',
          rose: '#FF4D8D',
          'rose-soft': 'rgba(255, 77, 141, 0.15)',
          'rose-glow': 'rgba(255, 77, 141, 0.35)',
          amber: '#FBBF24',
          'amber-soft': 'rgba(251, 191, 36, 0.15)',
        },
        paper: {
          white: 'var(--paper-white)',
          muted: 'var(--paper-muted)',
          faint: '#4A5568',
        },
      },
      fontFamily: {
        display: [
          'var(--font-display)',
          'Bricolage Grotesque',
          'system-ui',
          'sans-serif',
        ],
        body: [
          'var(--font-body)',
          'Hanken Grotesk',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          'var(--font-body)',
          'Hanken Grotesk',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'var(--font-mono)',
          'Martian Mono',
          'monospace',
        ],
      },
      borderRadius: {
        organic: '24px',
        drop: '24px 24px 6px 24px',
        'drop-other': '6px 24px 24px 24px',
        teardrop: '50% 50% 50% 0',
      },
      keyframes: {
        inkDropIn: {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(6px)', filter: 'blur(5px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)', filter: 'blur(0)' },
        },
        inkVapor: {
          '0%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)', filter: 'blur(6px)' },
        },
        inkRipplePulse: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        inkDriftSlow: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(25px, -15px) scale(1.05)' },
          '100%': { transform: 'translate(-20px, 20px) scale(0.97)' },
        },
      },
      animation: {
        'ink-drop': 'inkDropIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'ink-vapor': 'inkVapor 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'ink-ripple': 'inkRipplePulse 2.4s cubic-bezier(0, 0.2, 0.8, 1) infinite',
        'ink-drift': 'inkDriftSlow 40s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};

export default config;

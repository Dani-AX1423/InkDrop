/**
 * Midnight Ink Design System Tokens
 * Centralized design tokens for the InkDrop "Ink in Water" identity.
 */

export const INK_COLORS = {
  // Deep Water
  waterDeep: '#05070C',
  waterShallow: '#0A0F1A',
  waterMist: '#131A2B',

  // Surfaces & Highlights
  surfaceBase: '#0C121D',
  surfaceElevated: '#111A28',
  surfaceCard: 'rgba(14, 21, 33, 0.70)',
  surfaceBorder: 'rgba(150, 190, 255, 0.10)',
  surfaceBorderHover: 'rgba(150, 190, 255, 0.24)',

  // Pigments
  indigo: '#5B5BFF',
  indigoSoft: 'rgba(91, 91, 255, 0.15)',
  indigoGlow: 'rgba(91, 91, 255, 0.35)',

  teal: '#2DD4BF',
  tealSoft: 'rgba(45, 212, 191, 0.15)',
  tealGlow: 'rgba(45, 212, 191, 0.35)',

  rose: '#FF4D8D',
  roseSoft: 'rgba(255, 77, 141, 0.15)',
  roseGlow: 'rgba(255, 77, 141, 0.35)',

  amber: '#FBBF24',
  amberSoft: 'rgba(251, 191, 36, 0.15)',

  // Tamed Deep Blobs (Max 18-20% opacity, off-center)
  blobIndigo: '#1B1B4B',
  blobTeal: '#0F3B44',
  blobWine: '#2B1224',

  // Paper & Typography
  paperWhite: '#EDE8DC',
  paperMuted: '#7F8CA3',
  paperFaint: '#4A5568',
} as const;

export const TYPOGRAPHY = {
  fontDisplay: 'var(--font-display)',
  fontBody: 'var(--font-body)',
  fontMono: 'var(--font-mono)',
  scale: {
    hero: 'clamp(2.5rem, 5.5vw, 4.25rem)',
    h1: '2.5rem',
    h2: '2rem',
    h3: '1.5rem',
    bodyBase: '15px',
    bodySm: '13px',
    mono: '11px',
  },
  lineHeight: {
    display: '1.04',
    body: '1.55',
  },
  maxWidth: {
    editorial: '52ch',
  },
} as const;

// Deterministic ink color palette for external user handles and droplet avatars
export const USER_INK_PALETTE = [
  { color: '#5B5BFF', bg: 'rgba(91, 91, 255, 0.18)', border: 'rgba(91, 91, 255, 0.35)' }, // Indigo
  { color: '#2DD4BF', bg: 'rgba(45, 212, 191, 0.18)', border: 'rgba(45, 212, 191, 0.35)' }, // Teal
  { color: '#FF4D8D', bg: 'rgba(255, 77, 141, 0.18)', border: 'rgba(255, 77, 141, 0.35)' }, // Rose
  { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.18)', border: 'rgba(167, 139, 250, 0.35)' }, // Violet
  { color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.35)' }, // Cyan
  { color: '#F472B6', bg: 'rgba(244, 114, 182, 0.18)', border: 'rgba(244, 114, 182, 0.35)' }, // Pink
  { color: '#34D399', bg: 'rgba(52, 211, 153, 0.18)', border: 'rgba(52, 211, 153, 0.35)' }, // Emerald
  { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.35)' }, // Amber
] as const;

/**
 * Returns a stable ink color theme derived from a user alias string
 */
export function getInkColorForSender(sender: string): (typeof USER_INK_PALETTE)[number] {
  if (!sender) return USER_INK_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = (hash << 5) - hash + sender.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % USER_INK_PALETTE.length;
  return USER_INK_PALETTE[index];
}

// Random aesthetic alias generator for the lobby shuffle button
const ALIAS_ADJECTIVES = [
  'Silent', 'Midnight', 'Deep', 'Liquid', 'Still', 'Velvet',
  'Shaded', 'Vapor', 'Echoing', 'Hollow', 'Drifting', 'Lucid',
  'Obscure', 'Fading', 'Cobalt', 'Submerged', 'Indigo', 'Misted'
];

const ALIAS_NOUNS = [
  'Droplet', 'Ripple', 'Current', 'Tide', 'Shadow', 'Pebble',
  'Whirl', 'Specter', 'Trace', 'Reflection', 'Vessel', 'Wave',
  'Pool', 'Drifter', 'Depth', 'Glow', 'Ink', 'Echo'
];

export function generateRandomAlias(): string {
  const adj = ALIAS_ADJECTIVES[Math.floor(Math.random() * ALIAS_ADJECTIVES.length)];
  const noun = ALIAS_NOUNS[Math.floor(Math.random() * ALIAS_NOUNS.length)];
  const randNum = Math.floor(10 + Math.random() * 89);
  return `${adj}${noun}_${randNum}`;
}

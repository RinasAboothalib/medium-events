// Corporate palette. Mirrored as Tailwind tokens in src/index.css (@theme) — keep both in sync.

export const PALETTE = {
  brand: '#12229D',
  brandHover: '#0E1A7A',
  brandTint: '#EEF0FB',
  ink: '#101828',
  body: '#475467',
  muted: '#667085',
  line: '#E4E7EC',
  surface: '#F8FAFC',
  footer: '#0A1240',
  onBrandMuted: '#C7CCF5',
  white: '#FFFFFF',
} as const;

type Colour = keyof typeof PALETTE;

// Every text/background combination the design uses; checked against WCAG AA in tests
export const TEXT_PAIRS: { fg: Colour; bg: Colour; large?: boolean }[] = [
  { fg: 'ink', bg: 'white' },
  { fg: 'body', bg: 'white' },
  { fg: 'body', bg: 'surface' },
  { fg: 'muted', bg: 'white' },
  { fg: 'muted', bg: 'surface' },
  { fg: 'brand', bg: 'white' },
  { fg: 'white', bg: 'brand' },
  { fg: 'onBrandMuted', bg: 'brand' },
  { fg: 'white', bg: 'footer' },
  { fg: 'onBrandMuted', bg: 'footer' },
  { fg: 'brand', bg: 'brandTint' },
  { fg: 'white', bg: 'brandHover' },
];

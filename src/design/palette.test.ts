import { describe, expect, it } from 'vitest';
import { PALETTE, TEXT_PAIRS } from './palette';
import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });
});

describe('palette', () => {
  it('uses the exact colours from the spec', () => {
    expect(PALETTE).toMatchObject({
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
    });
  });

  it.each(TEXT_PAIRS)('$fg on $bg meets WCAG AA', ({ fg, bg, large }) => {
    expect(contrastRatio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });
});

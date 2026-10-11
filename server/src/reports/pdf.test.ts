import { describe, expect, it } from 'vitest';
import { day, maldivesTime } from './pdf.js';

describe('report dates', () => {
  it('writes calendar days and Maldives times with short month names', () => {
    expect(day('2025-09-02')).toBe('2 Sep 2025');
    expect(maldivesTime(new Date('2026-09-02T04:30:00Z'))).toBe('2 Sep 2026, 09:30');
    expect(maldivesTime(new Date('2026-12-31T20:00:00Z'))).toBe('1 Jan 2027, 01:00');
  });
});

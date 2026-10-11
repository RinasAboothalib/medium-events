import { describe, expect, it } from 'vitest';
import { formatDay, formatWhen, maldivesToday } from './dates';

describe('dates', () => {
  it('writes calendar days with short month names', () => {
    expect(formatDay('2025-09-02')).toBe('2 Sep 2025');
    expect(formatDay('2026-10-13')).toBe('13 Oct 2026');
  });

  it('writes moments in Maldives time', () => {
    expect(formatWhen('2026-09-02T04:30:00Z')).toBe('2 Sep 2026, 09:30');
    expect(formatWhen('2026-12-31T20:00:00Z')).toBe('1 Jan 2027, 01:00');
  });

  it("knows today's date in the Maldives", () => {
    expect(maldivesToday(new Date('2026-10-12T19:30:00Z'))).toBe('2026-10-13');
  });
});

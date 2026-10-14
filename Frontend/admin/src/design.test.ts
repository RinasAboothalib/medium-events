import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '@site/design/palette';

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('admin palette', () => {
  it('matches the public site palette exactly', () => {
    const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8').toLowerCase();
    for (const [key, hex] of Object.entries(PALETTE)) {
      if (key === 'white') continue;
      expect(css, key).toContain(`--color-${kebab(key)}: ${hex.toLowerCase()};`);
    }
  });
});

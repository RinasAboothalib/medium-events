import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test starts its own in-memory database, which takes several seconds on slower machines
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

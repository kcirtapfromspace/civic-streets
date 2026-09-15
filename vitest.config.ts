import { defineConfig } from 'vitest/config';
import path from 'path';
import { sourceInclude, sourceExclude } from './scripts/testing/coverage-policy.mjs';

export default defineConfig({
  test: {
    include: ['{src,convex,shared}/**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-fixtures/setup.ts'],
    allowOnly: !process.env.CI,
    coverage: {
      provider: 'v8',
      include: sourceInclude,
      exclude: sourceExclude,
      reporter: ['text-summary', 'html', 'json', 'json-summary', 'lcov'],
      reportOnFailure: true,
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

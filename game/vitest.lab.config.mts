/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Lab harness entry point (tests/lab/README.md). Separate from the default
// gate: `vitest run` uses vite.config.ts whose include no longer covers
// tests/lab, so `npm run lab`/`lab:watch` point vitest here explicitly.
// environment: 'node' + the @/ alias mirror vite.config.ts's test block.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/lab/**/*.test.ts'],
  },
})

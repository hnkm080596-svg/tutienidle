import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

// Standalone config for QA evidence probes - these test the product
// seams the attack model declares, but live inside docs/qa/runs/ so
// they never move the productStateId hash.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(configDir, '../../../../../src'),
    },
  },
  test: {
    include: [path.join(configDir, '*.test.ts')],
    environment: 'node',
  },
})

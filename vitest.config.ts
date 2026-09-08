import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
})

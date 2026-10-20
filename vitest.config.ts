import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    REACT_APP_DEPLOY_ENV: JSON.stringify(''),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})

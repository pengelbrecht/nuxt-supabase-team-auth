import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'playground/',
        '**/*.d.ts',
        'tests/',
        'vitest.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '#app': fileURLToPath(new URL('./tests/mocks/nuxt-app.ts', import.meta.url)),
      '#imports': fileURLToPath(new URL('./tests/mocks/imports.ts', import.meta.url)),
    },
  },
})

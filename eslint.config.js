import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: {
      semi: false,
      quotes: 'single',
    },
  },
  dirs: {
    src: [
      './src',
    ],
  },
}).override('nuxt/typescript/rules', {
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}).override('nuxt/typescript/rules', {
  files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*.ts', '**/tests/**/*.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
})

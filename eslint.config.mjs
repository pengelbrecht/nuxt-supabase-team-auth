// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: true,
  },
  dirs: {
    src: [
      './playground',
    ],
  },
}).append({
  rules: {
    // Vue rules
    'vue/no-multiple-template-root': 'off',
    'vue/max-attributes-per-line': ['error', { singleline: 3 }],
    'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
    'vue/define-macros-order': ['error', { order: ['defineProps', 'defineEmits'] }],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-separate-static-class': 'error',

    // TypeScript strict rules
    '@typescript-eslint/no-explicit-any': 'warn', // Start with warn, upgrade to error later
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
})

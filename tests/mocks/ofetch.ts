import { vi } from 'vitest'

// Use the same mock instance as the tests expect
export const $fetch = global.$fetch || vi.fn()

// Also make sure it's available on global for tests that expect it there
if (!global.$fetch) {
  global.$fetch = $fetch
}

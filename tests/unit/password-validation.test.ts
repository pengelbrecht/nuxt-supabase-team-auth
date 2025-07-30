import { describe, test, expect } from 'vitest'
import { validatePassword, generatePasswordHelpText } from '../../src/runtime/utils/password-validation'
import type { PasswordPolicy } from '../../src/runtime/types/password-policy'

describe('Password Validation', () => {
  describe('validatePassword', () => {
    test('should validate with default policy', () => {
      // Valid passwords with defaults (only length matters)
      const result1 = validatePassword('password')
      expect(result1.isValid).toBe(true)
      expect(result1.errors).toHaveLength(0)

      const result2 = validatePassword('12345678')
      expect(result2.isValid).toBe(true)
      expect(result2.errors).toHaveLength(0)

      const result3 = validatePassword('ALLCAPS!')
      expect(result3.isValid).toBe(true)
      expect(result3.errors).toHaveLength(0)

      // Too short
      const result4 = validatePassword('short')
      expect(result4.isValid).toBe(false)
      expect(result4.errors).toContain('Password must be at least 8 characters')

      const result5 = validatePassword('1234567')
      expect(result5.isValid).toBe(false)
      expect(result5.errors).toContain('Password must be at least 8 characters')
    })

    test('should validate with custom minimum length', () => {
      const policy: PasswordPolicy = { minLength: 12 }

      const result1 = validatePassword('Password123', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password must be at least 12 characters')

      const result2 = validatePassword('Password12345', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with enabled uppercase requirement', () => {
      const policy: PasswordPolicy = { requireUppercase: true }

      const result1 = validatePassword('password123', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password must contain at least one uppercase letter')

      const result2 = validatePassword('Password123', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with enabled lowercase requirement', () => {
      const policy: PasswordPolicy = { requireLowercase: true }

      const result1 = validatePassword('PASSWORD123', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password must contain at least one lowercase letter')

      const result2 = validatePassword('Password123', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with enabled number requirement', () => {
      const policy: PasswordPolicy = { requireNumbers: true }

      const result1 = validatePassword('PasswordOnly', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password must contain at least one number')

      const result2 = validatePassword('Password123', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with special character requirement', () => {
      const policy: PasswordPolicy = { requireSpecialChars: true }

      const result1 = validatePassword('Password123', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password must contain at least one special character')

      const result2 = validatePassword('Password123!', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with custom special characters', () => {
      const policy: PasswordPolicy = {
        requireSpecialChars: true,
        specialChars: '@#$',
      }

      const result1 = validatePassword('Password123!', policy)
      expect(result1.isValid).toBe(false)

      const result2 = validatePassword('Password123@', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should validate with custom validator', () => {
      const policy: PasswordPolicy = {
        customValidator: (password) => {
          if (password.toLowerCase().includes('password')) {
            return 'Password cannot contain the word "password"'
          }
          return true
        },
      }

      const result1 = validatePassword('Password123', policy)
      expect(result1.isValid).toBe(false)
      expect(result1.errors).toContain('Password cannot contain the word "password"')

      const result2 = validatePassword('SecurePass123', policy)
      expect(result2.isValid).toBe(true)
    })

    test('should handle multiple validation errors', () => {
      const policy: PasswordPolicy = {
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
      }
      const result = validatePassword('abc', policy)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(3) // Too short, no uppercase, no numbers
    })

    test('should handle empty password', () => {
      const result = validatePassword('')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should handle unicode characters', () => {
      const result = validatePassword('Pássword')
      expect(result.isValid).toBe(true)
    })

    test('should handle very long passwords', () => {
      const longPassword = 'a'.repeat(100)
      const result = validatePassword(longPassword)
      expect(result.isValid).toBe(true)
    })
  })

  describe('generatePasswordHelpText', () => {
    test('should generate help text with default policy', () => {
      const helpText = generatePasswordHelpText()
      expect(helpText).toBe('Must be at least 8 characters')
    })

    test('should generate help text with custom minimum length', () => {
      const helpText = generatePasswordHelpText({ minLength: 12 })
      expect(helpText).toBe('Must be at least 12 characters')
    })

    test('should generate help text with special characters required', () => {
      const helpText = generatePasswordHelpText({ requireSpecialChars: true })
      expect(helpText).toBe('Must be at least 8 characters with special characters')
    })

    test('should generate help text with only length requirement', () => {
      const helpText = generatePasswordHelpText({
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
      })
      expect(helpText).toBe('Must be at least 8 characters')
    })

    test('should generate help text with some requirements enabled', () => {
      const helpText = generatePasswordHelpText({
        requireUppercase: true,
        requireNumbers: true,
      })
      expect(helpText).toBe('Must be at least 8 characters with uppercase, numbers')
    })

    test('should use custom help text when provided', () => {
      const helpText = generatePasswordHelpText({
        helpText: 'Use a strong passphrase with 15+ characters',
      })
      expect(helpText).toBe('Use a strong passphrase with 15+ characters')
    })

    test('should ignore other settings when custom help text is provided', () => {
      const helpText = generatePasswordHelpText({
        minLength: 20,
        requireSpecialChars: true,
        helpText: 'Custom help text',
      })
      expect(helpText).toBe('Custom help text')
    })
  })
})

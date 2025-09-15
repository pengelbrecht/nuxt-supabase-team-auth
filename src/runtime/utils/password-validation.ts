import type { PasswordPolicy, PasswordValidationResult } from '../types/password-policy'
import { DEFAULT_PASSWORD_POLICY } from '../types/password-policy'
import * as v from 'valibot'

/**
 * Validates a password against the provided policy
 */
export function validatePassword(password: string, policy: PasswordPolicy = {}): PasswordValidationResult {
  const errors: string[] = []
  const mergedPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy }

  // Check minimum length
  if (password.length < mergedPolicy.minLength) {
    errors.push(`Password must be at least ${mergedPolicy.minLength} characters`)
  }

  // Check uppercase requirement
  if (mergedPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  // Check lowercase requirement
  if (mergedPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  // Check number requirement
  if (mergedPolicy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Check special character requirement
  if (mergedPolicy.requireSpecialChars) {
    // Escape special regex characters within a character class
    // We need to escape: \ ] ^ -
    const escapedChars = mergedPolicy.specialChars
      .replace(/\\/g, '\\\\') // Escape backslash first
      .replace(/\]/g, '\\]') // Escape closing bracket
      .replace(/\^/g, '\\^') // Escape caret
      .replace(/-/g, '\\-') // Escape hyphen
    const specialCharsRegex = new RegExp(`[${escapedChars}]`)
    if (!specialCharsRegex.test(password)) {
      errors.push('Password must contain at least one special character')
    }
  }

  // Run custom validator if provided
  if (policy.customValidator) {
    const customResult = policy.customValidator(password)
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : 'Password does not meet custom requirements')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Generates help text based on the password policy
 */
export function generatePasswordHelpText(policy: PasswordPolicy = {}): string {
  // If custom help text is provided, use it
  if (policy.helpText) {
    return policy.helpText
  }

  const mergedPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy }
  const requirements: string[] = []

  // Add length requirement
  requirements.push(`at least ${mergedPolicy.minLength} characters`)

  // Build character requirements
  const charRequirements: string[] = []
  if (mergedPolicy.requireUppercase) charRequirements.push('uppercase')
  if (mergedPolicy.requireLowercase) charRequirements.push('lowercase')
  if (mergedPolicy.requireNumbers) charRequirements.push('numbers')
  if (mergedPolicy.requireSpecialChars) charRequirements.push('special characters')

  if (charRequirements.length > 0) {
    requirements.push(charRequirements.join(', '))
  }

  return `Must be ${requirements.join(' with ')}`
}

/**
 * Creates a Valibot schema for password validation based on the policy
 */
export function createPasswordSchema(policy: PasswordPolicy = {}) {
  const mergedPolicy = { ...DEFAULT_PASSWORD_POLICY, ...policy }

  const pipes: any[] = [
    v.string(),
    v.minLength(mergedPolicy.minLength, `Password must be at least ${mergedPolicy.minLength} characters`),
  ]

  if (mergedPolicy.requireUppercase) {
    pipes.push(v.regex(/[A-Z]/, 'Password must contain at least one uppercase letter'))
  }

  if (mergedPolicy.requireLowercase) {
    pipes.push(v.regex(/[a-z]/, 'Password must contain at least one lowercase letter'))
  }

  if (mergedPolicy.requireNumbers) {
    pipes.push(v.regex(/\d/, 'Password must contain at least one number'))
  }

  if (mergedPolicy.requireSpecialChars) {
    // Escape special regex characters within a character class
    const escapedChars = mergedPolicy.specialChars
      .replace(/\\/g, '\\\\') // Escape backslash first
      .replace(/\]/g, '\\]') // Escape closing bracket
      .replace(/\^/g, '\\^') // Escape caret
      .replace(/-/g, '\\-') // Escape hyphen
    const specialCharsRegex = new RegExp(`[${escapedChars}]`)
    pipes.push(v.regex(specialCharsRegex, 'Password must contain at least one special character'))
  }

  if (policy.customValidator) {
    pipes.push(v.custom((value: string) => {
      const result = policy.customValidator!(value)
      return result === true
    }, (value: string) => {
      const result = policy.customValidator!(value)
      return typeof result === 'string' ? result : 'Password does not meet custom requirements'
    }))
  }

  return v.pipe(...pipes)
}

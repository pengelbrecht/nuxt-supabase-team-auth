export interface PasswordPolicy {
  /**
   * Minimum password length
   * @default 8
   */
  minLength?: number

  /**
   * Require at least one uppercase letter (A-Z)
   * @default false
   */
  requireUppercase?: boolean

  /**
   * Require at least one lowercase letter (a-z)
   * @default false
   */
  requireLowercase?: boolean

  /**
   * Require at least one number (0-9)
   * @default false
   */
  requireNumbers?: boolean

  /**
   * Require at least one special character
   * @default false
   */
  requireSpecialChars?: boolean

  /**
   * Define which special characters are allowed/required
   * @default "!@#$%^&*()_+-=[]{}|;:,.<>?"
   */
  specialChars?: string

  /**
   * Custom validation function for advanced requirements
   * Return true if valid, or a string error message if invalid
   */
  customValidator?: (password: string) => boolean | string

  /**
   * Custom help text to override the auto-generated help text
   */
  helpText?: string
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
}

export const DEFAULT_PASSWORD_POLICY: Required<Omit<PasswordPolicy, 'customValidator' | 'helpText'>> = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecialChars: false,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

import { computed } from 'vue'
import * as v from 'valibot'
import type { PasswordPolicy } from '../types/password-policy'
import { validatePassword, generatePasswordHelpText, createPasswordSchema } from '../utils/password-validation'
import { useRuntimeConfig } from '#imports'

/**
 * Composable to access and use the password policy configuration
 */
export function usePasswordPolicy() {
  const config = useRuntimeConfig()

  // Get the password policy from runtime config
  const passwordPolicy = computed<PasswordPolicy>(() => {
    return config.public?.teamAuth?.passwordPolicy || {}
  })

  // Get generated help text
  const passwordHelpText = computed(() => {
    return generatePasswordHelpText(passwordPolicy.value)
  })

  // Validate a password
  const validate = (password: string) => {
    return validatePassword(password, passwordPolicy.value)
  }

  // Get Valibot schema for forms
  const getPasswordSchema = () => {
    return createPasswordSchema(passwordPolicy.value)
  }

  // Create a custom validator for confirm password fields
  const createConfirmPasswordValidator = (getPasswordValue: () => string) => {
    return v.pipe(
      v.string(),
      v.check((value: string) => value === getPasswordValue(), 'Passwords do not match'),
    )
  }

  return {
    passwordPolicy: passwordPolicy.value,
    passwordHelpText,
    validate,
    getPasswordSchema,
    createConfirmPasswordValidator,
  }
}

import { computed } from 'vue'
import type { SocialProvidersConfig } from '../types'
import { useNuxtApp } from '#app'

/**
 * Team Auth configuration composable
 * Provides access to module configuration values
 */
export function useTeamAuthConfig() {
  const { $config } = useNuxtApp()

  const config = computed(() => $config.public.teamAuth || {})

  const debug = computed(() => config.value.debug || false)
  const redirectTo = computed(() => config.value.redirectTo || '/dashboard')
  const loginPage = computed(() => config.value.loginPage || '/signin')
  const supabaseUrl = computed(() => config.value.supabaseUrl)
  const supabaseKey = computed(() => config.value.supabaseKey)

  // Social providers configuration with defaults
  const socialProviders = computed<SocialProvidersConfig>(() => {
    const providers = config.value.socialProviders || {}
    return {
      google: {
        enabled: true, // Default enabled for backward compatibility
        ...providers.google,
      },
      // Future providers will be added here when implemented
    }
  })

  // Convenience getters for individual providers
  const isGoogleEnabled = computed(() => socialProviders.value.google?.enabled ?? true)
  const isGithubEnabled = computed(() => false) // GitHub auth not implemented

  // Check if any social provider is enabled
  const hasAnySocialProvider = computed(() => {
    return isGoogleEnabled.value
  })

  return {
    config,
    debug,
    redirectTo,
    loginPage,
    supabaseUrl,
    supabaseKey,
    socialProviders,
    isGoogleEnabled,
    isGithubEnabled,
    hasAnySocialProvider,
  }
}

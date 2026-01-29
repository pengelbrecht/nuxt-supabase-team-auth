import { computed } from 'vue'
import type { SocialProvidersConfig } from '../types'
import { useRuntimeConfig } from '#imports'

interface TeamAuthConfig {
  redirectTo?: string
  loginPage?: string
  supabaseUrl?: string
  supabaseKey?: string
  socialProviders?: SocialProvidersConfig
}

/**
 * Team Auth configuration composable
 * Provides access to module configuration values
 */
export function useTeamAuthConfig() {
  const runtimeConfig = useRuntimeConfig()

  const config = computed<TeamAuthConfig>(() => (runtimeConfig.public.teamAuth as TeamAuthConfig) || {})

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

import { computed } from 'vue'

/**
 * Team Auth configuration composable
 * Provides access to module configuration values
 */
export function useTeamAuthConfig() {
  const { $config } = useNuxtApp()

  const config = computed(() => $config.public.teamAuth || {})

  const debug = computed(() => config.value.debug || false)
  const redirectTo = computed(() => config.value.redirectTo || '/dashboard')
  const supabaseUrl = computed(() => config.value.supabaseUrl)
  const supabaseKey = computed(() => config.value.supabaseKey)

  return {
    config,
    debug,
    redirectTo,
    supabaseUrl,
    supabaseKey,
  }
}

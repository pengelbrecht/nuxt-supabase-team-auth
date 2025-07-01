import { useNuxtApp, useState } from '#app'

/**
 * Wrapper composables for @nuxtjs/supabase that work in published modules
 *
 * The official @nuxtjs/supabase composables use auto-imports (#imports) which don't work
 * in published npm modules. These wrappers access the same functionality through useNuxtApp()
 * and useState(), which are available in published modules.
 */

/**
 * Get the Supabase client instance
 * Equivalent to @nuxtjs/supabase's useSupabaseClient()
 */
export const useSupabaseClient = () => {
  const nuxtApp = useNuxtApp()

  if (!nuxtApp.$supabase) {
    throw new Error(
      'Supabase not found in Nuxt app. Make sure @nuxtjs/supabase is properly configured in your nuxt.config.ts modules array and that NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY are set.',
    )
  }

  if (!nuxtApp.$supabase.client) {
    throw new Error(
      'Supabase client not found. The @nuxtjs/supabase module may not be properly initialized.',
    )
  }

  return nuxtApp.$supabase.client
}

/**
 * Get reactive Supabase session state
 * Equivalent to @nuxtjs/supabase's useSupabaseSession()
 */
export const useSupabaseSession = () => {
  return useState('supabase_session', () => null)
}

/**
 * Get reactive Supabase user state
 * Equivalent to @nuxtjs/supabase's useSupabaseUser()
 */
export const useSupabaseUser = () => {
  return useState('supabase_user', () => null)
}

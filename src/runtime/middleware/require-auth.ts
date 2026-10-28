import { useTeamAuth } from '../composables/useTeamAuth'
import { useSupabaseUser } from '../composables/useSupabaseComposables'
import { isServerRender } from '../utils/ssr'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Middleware to require user authentication
 * Redirects to login if user is not authenticated
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // Server: decide from the cookie-based Supabase user and never wait for
  // `isLoading` (it only clears in the browser). The client runs this again
  // on hydration.
  if (isServerRender()) {
    if (!useSupabaseUser().value) {
      const loginPage = useRuntimeConfig().public.teamAuth?.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    return
  }

  const { currentUser, isLoading } = useTeamAuth()

  // Wait for the initial auth resolution (success or confirmed-no-session).
  // Poll `isLoading` only: `currentUser` (and team/role) start as `null`
  // during hydration on a hard nav, so breaking out on `!== undefined`
  // fired on the first tick and judged a signed-in user as signed out.
  // Same fix as auth.global in gh#52.
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max (20 * 100ms)

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    // If still loading after timeout, proceed anyway to avoid hanging
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn('[Team Auth] Auth loading timeout in require-auth middleware, proceeding anyway')
    }
  }

  // Redirect to login if not authenticated
  if (!currentUser.value) {
    const config = useRuntimeConfig()
    const loginPage = config.public.teamAuth?.loginPage || '/signin'
    const redirectUrl = to.fullPath
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
  }
})

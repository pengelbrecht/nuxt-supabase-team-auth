import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Middleware to require user authentication
 * Redirects to login if user is not authenticated
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { currentUser, isLoading } = useTeamAuth()

  // More efficient auth loading wait with early exit
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max (20 * 100ms)

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++

      // Early exit if we have enough data for auth decisions
      if (currentUser.value !== undefined) {
        break
      }
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

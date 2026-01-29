import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Middleware to require team membership
 * In single-team model, this simply ensures user is authenticated and has their team loaded
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { currentUser, currentTeam, currentRole, isLoading } = useTeamAuth()

  // More efficient auth loading wait with early exit
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max (20 * 100ms)

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++

      // Early exit if we have enough data for team decisions
      if (currentUser.value !== undefined && currentTeam.value !== undefined) {
        break
      }
    }

    // If still loading after timeout, proceed anyway to avoid hanging
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn('[Team Auth] Auth loading timeout in require-team middleware, proceeding anyway')
    }
  }

  // Ensure user is authenticated
  if (!currentUser.value) {
    const redirectUrl = to.fullPath
    const config = useRuntimeConfig()
    const loginPage = config.public.teamAuth?.loginPage || '/signin'
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  // In single-team model, authenticated users should always have a team
  // This should never happen, but guard against data corruption
  if (!currentTeam.value || !currentRole.value) {
    console.error('[Team Auth] Authenticated user missing team/role - data integrity issue. User ID:', currentUser.value.id)
    const config = useRuntimeConfig()
    const loginPage = config.public.teamAuth?.loginPage || '/signin'
    return navigateTo(`${loginPage}?error=account_misconfigured`)
  }
})

// Legacy multi-team functions removed - not needed in single-team model
// In single-team model, all authenticated users have exactly one team
// Use the default export middleware instead

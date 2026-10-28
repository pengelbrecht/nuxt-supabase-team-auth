import { useTeamAuth } from '../composables/useTeamAuth'
import { isServerRender } from '../utils/ssr'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Middleware to redirect authenticated users away from auth pages
 * Useful for login/signup pages that authenticated users shouldn't see
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // Client-only: the team-auth user is only known in the browser (on the
  // server `currentUser` is always null and `isLoading` never clears), and the
  // redirect check below uses `window`. The client runs this again on hydration.
  if (isServerRender()) return

  const { currentUser, currentTeam, isLoading } = useTeamAuth()

  // Wait for the initial auth resolution (success or confirmed-no-session).
  // Poll `isLoading` only: `currentUser` (and team/role) start as `null`
  // during hydration on a hard nav, so breaking out on `!== undefined`
  // fired on the first tick and judged a signed-in user as signed out.
  // Same fix as auth.global in gh#52.
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max instead of 5

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    // If still loading, proceed anyway to avoid hanging
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn('[Team Auth] Auth loading timeout in redirect middleware, proceeding anyway')
    }
  }

  // If user is authenticated, redirect them away from auth pages
  if (currentUser.value) {
    // Check if there's a redirect URL in query params
    const redirectTo = to.query.redirect as string

    if (redirectTo) {
      // Validate redirect URL for security
      try {
        const url = new URL(redirectTo, window.location.origin)
        // Only allow same-origin redirects
        if (url.origin === window.location.origin) {
          return navigateTo(redirectTo)
        }
      }
      catch {
        // Invalid URL, fall through to default redirect
      }
    }

    // In single-team model, authenticated users always have a team
    // This should never happen, but guard against data corruption
    if (!currentTeam.value) {
      console.error('[Team Auth] Authenticated user missing team - data integrity issue. User ID:', currentUser.value.id)
      const config = useRuntimeConfig()
      const loginPage = config.public.teamAuth?.loginPage || '/signin'
      return navigateTo(`${loginPage}?error=account_misconfigured`)
    }

    // Get redirect destination from config
    const config = useRuntimeConfig()
    const teamAuthConfig = config.public.teamAuth || {}
    const defaultRedirect = teamAuthConfig.redirectTo || '/dashboard'

    // Redirect to configured destination (user has team guaranteed)
    return navigateTo(defaultRedirect)
  }
})

/**
 * Create custom redirect middleware for authenticated users
 * @param redirectTo Where to redirect authenticated users
 * @param condition Optional condition function to determine if redirect should happen
 */
export function createRedirectAuthenticated(
  redirectTo: string | ((user: unknown, team: unknown) => string),
  condition?: (user: unknown, team: unknown, route: RouteLocationNormalized) => boolean,
) {
  return defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
    // Client-only, see the default export above.
    if (isServerRender()) return

    const { currentUser, currentTeam, isLoading } = useTeamAuth()

    // Wait for the initial auth resolution (success or confirmed-no-session).
    // Poll `isLoading` only: `currentUser` (and team/role) start as `null`
    // during hydration on a hard nav, so breaking out on `!== undefined`
    // fired on the first tick and judged a signed-in user as signed out.
    // Same fix as auth.global in gh#52.
    if (isLoading.value) {
      let attempts = 0
      const maxAttempts = 20 // 2 seconds max instead of 5

      while (isLoading.value && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      // If still loading, proceed anyway to avoid hanging
      if (isLoading.value && attempts >= maxAttempts) {
        console.warn('[Team Auth] Auth loading timeout in custom redirect middleware, proceeding anyway')
      }
    }

    // Check if user is authenticated
    if (currentUser.value) {
      // Apply condition if provided
      if (condition && !condition(currentUser.value, currentTeam.value, to)) {
        return
      }

      // Determine redirect URL
      const url = typeof redirectTo === 'function'
        ? redirectTo(currentUser.value, currentTeam.value)
        : redirectTo

      return navigateTo(url)
    }
  })
}

/**
 * Predefined redirect middleware variants
 */
export const redirectToDashboard = createRedirectAuthenticated('/dashboard')
// Legacy multi-team variants removed - not needed in single-team model

import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo } from '#app'

/**
 * Middleware to redirect authenticated users away from auth pages
 * Useful for login/signup pages that authenticated users shouldn't see
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentTeam, isLoading } = useTeamAuth()

  // Wait for auth state to load
  if (isLoading.value) {
    let attempts = 0
    while (isLoading.value && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
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

    // Default redirect logic based on user state
    if (currentTeam.value) {
      // User has a team, redirect to dashboard
      return navigateTo('/dashboard')
    }
    else {
      // User needs to select/create a team
      return navigateTo('/teams')
    }
  }
})

/**
 * Create custom redirect middleware for authenticated users
 * @param redirectTo Where to redirect authenticated users
 * @param condition Optional condition function to determine if redirect should happen
 */
export function createRedirectAuthenticated(
  redirectTo: string | ((user: any, team: any) => string),
  condition?: (user: any, team: any, route: any) => boolean,
) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentTeam, isLoading } = useTeamAuth()

    // Wait for auth state to load
    if (isLoading.value) {
      let attempts = 0
      while (isLoading.value && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
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
export const redirectToTeams = createRedirectAuthenticated('/teams')
export const redirectBasedOnTeam = createRedirectAuthenticated(
  (user, team) => team ? '/dashboard' : '/teams',
)

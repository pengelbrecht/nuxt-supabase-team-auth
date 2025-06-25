import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo } from '#app'

/**
 * Middleware to require team membership
 * Ensures user belongs to a team and optionally validates team ID from route
 */
export default defineNuxtRouteMiddleware(async (to) => {
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
    const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
    const config = useRuntimeConfig()
    const loginPage = config.public.teamAuth?.loginPage || '/signin'
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  // Ensure user belongs to a team
  if (!currentTeam.value || !currentRole.value) {
    return navigateTo('/teams?message=select_team_first')
  }

  // If route has team ID parameter, validate it matches user's current team
  const teamIdFromRoute = to.params.teamId as string
  if (teamIdFromRoute && teamIdFromRoute !== currentTeam.value.id) {
    return navigateTo('/teams?error=unauthorized_team_access')
  }
})

/**
 * Create middleware that validates specific team access
 * @param options Configuration options
 * @param options.allowAnyTeam If true, allows access to any team the user is a member of
 * @param options.redirectTo Path to redirect to when access is denied
 * @param options.errorMessage Custom error message to display
 * @param options.validateMembership If true, validates user is a member of the specified team
 */
export function createTeamAccessMiddleware(options: {
  allowAnyTeam?: boolean
  redirectTo?: string
  errorMessage?: string
  validateMembership?: boolean
} = {}) {
  return defineNuxtRouteMiddleware(async (to) => {
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
        console.warn('[Team Auth] Auth loading timeout in require-team custom middleware, proceeding anyway')
      }
    }

    // Ensure user is authenticated
    if (!currentUser.value) {
      const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
      const config = useRuntimeConfig()
      const loginPage = config.public.teamAuth?.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }

    // Check team membership requirement
    if (!options.allowAnyTeam && (!currentTeam.value || !currentRole.value)) {
      return navigateTo('/teams?message=select_team_first')
    }

    // Validate team ID from route if present
    const teamIdFromRoute = to.params.teamId as string
    if (teamIdFromRoute) {
      // If user has a current team, it must match the route
      if (currentTeam.value && teamIdFromRoute !== currentTeam.value.id) {
        const redirectTo = options.redirectTo || '/teams'
        const errorParam = options.errorMessage || 'unauthorized_team_access'
        return navigateTo(`${redirectTo}?error=${errorParam}`)
      }

      // If user doesn't have a current team but route specifies one,
      // they need to select/join the team first
      if (!currentTeam.value) {
        return navigateTo(`/teams/${teamIdFromRoute}/join`)
      }

      // Optional: Additional membership validation via API
      if (options.validateMembership && currentUser.value && currentTeam.value) {
        try {
          // This would make an API call to verify current membership
          // For now, we trust the local state from useTeamAuth
          const isValidMember = currentRole.value !== null

          if (!isValidMember) {
            return navigateTo('/teams?error=membership_invalid')
          }
        }
        catch (error) {
          console.error('Team membership validation failed:', error)
          return navigateTo('/teams?error=validation_failed')
        }
      }
    }
  })
}

/**
 * Predefined team access middleware variants
 */
export const requireTeamMembership = createTeamAccessMiddleware()
export const requireAnyTeam = createTeamAccessMiddleware({ allowAnyTeam: true })
export const requireValidatedTeam = createTeamAccessMiddleware({ validateMembership: true })

import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo } from '#app'

/**
 * Middleware to require team membership
 * Ensures user belongs to a team and optionally validates team ID from route
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentTeam, currentRole, isLoading } = useTeamAuth()

  // Wait for auth state to load
  if (isLoading.value) {
    let attempts = 0
    while (isLoading.value && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
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
 */
export function createTeamAccessMiddleware(options: {
  allowAnyTeam?: boolean
  redirectTo?: string
  errorMessage?: string
  validateMembership?: boolean
} = {}) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentTeam, currentRole, isLoading } = useTeamAuth()

    // Wait for auth state to load
    if (isLoading.value) {
      let attempts = 0
      while (isLoading.value && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
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

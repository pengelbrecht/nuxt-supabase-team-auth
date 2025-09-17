import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'

type TeamRole = 'owner' | 'admin' | 'member' | 'super_admin'

/**
 * Role hierarchy levels for comparison
 */
const ROLE_HIERARCHY: Record<TeamRole, number> = {
  super_admin: 4,
  owner: 3,
  admin: 2,
  member: 1,
}

/**
 * Create middleware that requires a specific role or higher
 * @param requiredRole The minimum role required
 * @param options Additional options
 * @param options.redirectTo Path to redirect to when access is denied
 * @param options.errorMessage Custom error message to display
 * @param options.strict If true, requires exact role match instead of minimum role
 */
export function createRequireRoleMiddleware(
  requiredRole: TeamRole,
  options: {
    redirectTo?: string
    errorMessage?: string
    strict?: boolean // If true, requires exact role match
  } = {},
) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentRole, isLoading } = useTeamAuth()

    // More efficient auth loading wait with early exit
    if (isLoading.value) {
      let attempts = 0
      const maxAttempts = 20 // 2 seconds max (20 * 100ms)

      while (isLoading.value && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++

        // Early exit if we have enough data for role decisions
        if (currentUser.value !== undefined && currentRole.value !== undefined) {
          break
        }
      }

      // If still loading after timeout, proceed anyway to avoid hanging
      if (isLoading.value && attempts >= maxAttempts) {
        console.warn('[Team Auth] Auth loading timeout in require-role middleware, proceeding anyway')
      }
    }

    // Ensure user is authenticated
    if (!currentUser.value) {
      const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
      const config = useRuntimeConfig()
      const loginPage = config.public.teamAuth?.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }

    // In single-team model, authenticated users should always have a role
    // This should never happen, but guard against data corruption
    if (!currentRole.value) {
      console.error('[Team Auth] Authenticated user missing role - data integrity issue. User ID:', currentUser.value.id)
      return navigateTo('/signin?error=account_misconfigured')
    }

    // Check role permissions
    const userRoleLevel = ROLE_HIERARCHY[currentRole.value as TeamRole]
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole]

    if (!userRoleLevel || !requiredRoleLevel) {
      console.error('Invalid role detected:', { userRole: currentRole.value, requiredRole })
      return navigateTo('/dashboard?error=invalid_role')
    }

    // Check if user has sufficient role level
    const hasPermission = options.strict
      ? userRoleLevel === requiredRoleLevel
      : userRoleLevel >= requiredRoleLevel

    if (!hasPermission) {
      const redirectTo = options.redirectTo || '/dashboard'
      const errorParam = options.errorMessage || 'insufficient_permissions'
      return navigateTo(`${redirectTo}?error=${errorParam}`)
    }
  })
}

/**
 * Predefined role middleware
 */
export const requireAdmin = createRequireRoleMiddleware('admin')
export const requireOwner = createRequireRoleMiddleware('owner')
export const requireSuperAdmin = createRequireRoleMiddleware('super_admin')

/**
 * Strict role middleware (exact role match)
 */
export const requireAdminOnly = createRequireRoleMiddleware('admin', { strict: true })
export const requireOwnerOnly = createRequireRoleMiddleware('owner', { strict: true })
export const requireSuperAdminOnly = createRequireRoleMiddleware('super_admin', { strict: true })

/**
 * Default export for dynamic role checking
 */
export default defineNuxtRouteMiddleware(async (to, _from) => {
  // This middleware can be used with route meta to specify required role
  const requiredRole = to.meta.requireRole as TeamRole

  if (!requiredRole) {
    console.warn('require-role middleware used without specifying required role in route meta')
    return
  }

  const middleware = createRequireRoleMiddleware(requiredRole)
  return middleware(to, _from)
})

import { useTeamAuth } from '../composables/useTeamAuth'
import { useSupabaseUser } from '../composables/useSupabaseComposables'
import { isServerRender } from '../utils/ssr'
import { navigateTo, defineNuxtRouteMiddleware } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Middleware to handle impersonation restrictions
 * Blocks certain routes during impersonation and validates impersonation permissions
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // Client-only: impersonation and role state only exist in the browser, and
  // `isLoading` never clears on the server. The client runs this again on
  // hydration.
  if (isServerRender()) return

  const { currentUser, currentRole, isImpersonating, isLoading } = useTeamAuth()

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
    return
  }

  const currentPath = to.path

  // Handle impersonation routes (starting impersonation)
  if (currentPath.includes('/impersonate') && !currentPath.includes('/stop')) {
    // Only super admins can access impersonation routes
    if (currentRole.value !== 'super_admin') {
      return navigateTo('/dashboard?error=insufficient_permissions_for_impersonation')
    }
  }

  // Handle restrictions during active impersonation
  if (isImpersonating.value) {
    // Block admin routes during impersonation (except stopping impersonation)
    const blockedPaths = [
      '/admin/',
      '/super-admin/',
      '/impersonate/',
    ]

    const isBlockedPath = blockedPaths.some(path => currentPath.startsWith(path))
    const isStopImpersonation = currentPath.includes('/impersonate/stop')
      || currentPath.includes('/stop-impersonation')

    if (isBlockedPath && !isStopImpersonation) {
      return navigateTo('/dashboard?error=admin_routes_blocked_during_impersonation')
    }

    // Block dangerous operations during impersonation
    const dangerousPaths = [
      '/settings/delete',
      '/settings/transfer',
      '/team/delete',
      '/billing/',
      '/api-keys/',
      '/security/',
    ]

    const isDangerousPath = dangerousPaths.some(path => currentPath.includes(path))

    if (isDangerousPath) {
      return navigateTo('/dashboard?error=dangerous_operations_blocked_during_impersonation')
    }
  }
})

/**
 * Middleware specifically for impersonation start routes
 */
export const requireSuperAdminForImpersonation = defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // Server: only the authentication check can be made (from the cookie-based
  // Supabase user); the role check is left to the client, which runs this
  // again on hydration.
  if (isServerRender()) {
    if (!useSupabaseUser().value) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    return
  }

  const { currentUser, currentRole, isLoading } = useTeamAuth()

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
    const redirectUrl = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  // Only super admins can access impersonation features
  if (currentRole.value !== 'super_admin') {
    return navigateTo('/dashboard?error=super_admin_required')
  }
})

/**
 * Middleware to block access during impersonation
 */
export const blockDuringImpersonation = defineNuxtRouteMiddleware(async (_to: RouteLocationNormalized) => {
  // Client-only, see the default export above.
  if (isServerRender()) return

  const { isImpersonating, isLoading } = useTeamAuth()

  // Wait for auth state to load
  if (isLoading.value) {
    let attempts = 0
    while (isLoading.value && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }

  // Block access if currently impersonating
  if (isImpersonating.value) {
    return navigateTo('/dashboard?error=action_blocked_during_impersonation')
  }
})

/**
 * Create custom impersonation restriction middleware
 * @param options Configuration options
 * @param options.blockedPaths Array of paths to block during impersonation
 * @param options.allowedPaths Array of paths to allow during impersonation (overrides blockedPaths)
 * @param options.redirectTo Path to redirect to when access is blocked
 * @param options.errorMessage Custom error message to display
 * @param options.checkSuperAdmin Whether to also check if user is a super admin
 */
export function createImpersonationRestriction(options: {
  blockedPaths?: string[]
  allowedPaths?: string[]
  redirectTo?: string
  errorMessage?: string
  checkSuperAdmin?: boolean
} = {}) {
  return defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
    // Client-only, see the default export above.
    if (isServerRender()) return

    const { currentUser, currentRole, isImpersonating, isLoading } = useTeamAuth()

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
      return
    }

    const currentPath = to.path

    // Check super admin requirement if specified
    if (options.checkSuperAdmin && currentRole.value !== 'super_admin') {
      const redirectTo = options.redirectTo || '/dashboard'
      const errorParam = options.errorMessage || 'super_admin_required'
      return navigateTo(`${redirectTo}?error=${errorParam}`)
    }

    // Handle restrictions during impersonation
    if (isImpersonating.value) {
      const blockedPaths = options.blockedPaths || []
      const allowedPaths = options.allowedPaths || []

      // Check if current path is explicitly allowed
      const isAllowed = allowedPaths.some(path => currentPath.startsWith(path))
      if (isAllowed) {
        return
      }

      // Check if current path is blocked
      const isBlocked = blockedPaths.some(path => currentPath.startsWith(path))
      if (isBlocked) {
        const redirectTo = options.redirectTo || '/dashboard'
        const errorParam = options.errorMessage || 'access_blocked_during_impersonation'
        return navigateTo(`${redirectTo}?error=${errorParam}`)
      }
    }
  })
}

import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'

/**
 * Global authentication middleware
 * Runs on every route change to ensure proper authentication state
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentTeam, currentRole, isLoading, isImpersonating } = useTeamAuth()

  // More efficient auth loading wait with early exit
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max instead of 5

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++

      // Early exit if we have enough data for redirect decisions
      if (currentUser.value !== undefined) {
        break
      }
    }

    // If still loading, proceed anyway to avoid hanging
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn('[Team Auth] Auth loading timeout in middleware, proceeding anyway')
    }
  }

  // Get route protection config from runtime config
  const config = useRuntimeConfig()
  const teamAuthConfig = config.public.teamAuth || {}

  const defaultProtection = teamAuthConfig.defaultProtection || 'public'
  const configuredProtectedRoutes = teamAuthConfig.protectedRoutes || ['/dashboard']
  const configuredPublicRoutes = teamAuthConfig.publicRoutes || []

  // Always public auth routes
  const authRoutes = [
    '/login',
    '/signin',
    '/signup',
    '/auth',
    '/confirm',
    '/reset-password',
    '/forgot-password',
    '/accept-invite',
  ]

  const currentPath = to.path

  // Debug logging for troubleshooting
  console.log('[Team Auth] Middleware debug:', {
    currentPath,
    defaultProtection,
    configuredProtectedRoutes,
    configuredPublicRoutes,
    currentUser: currentUser.value ? 'logged in' : 'not logged in'
  })

  // Always allow access to auth routes and root
  const alwaysPublicRoutes = ['/', ...authRoutes]
  const isAlwaysPublic = alwaysPublicRoutes.some(route =>
    currentPath === route || currentPath.startsWith(route + '/'),
  )

  if (isAlwaysPublic) {
    console.log('[Team Auth] Allowing always public route:', currentPath)
    return
  }

  // Apply protection logic based on defaultProtection setting
  if (defaultProtection === 'public') {
    // Public by default - only protect routes explicitly listed in protectedRoutes
    const isProtectedRoute = configuredProtectedRoutes.some(route =>
      currentPath === route || currentPath.startsWith(route + '/'),
    )

    // Also allow access to additional configured public routes
    const isExplicitlyPublic = configuredPublicRoutes.some(route =>
      currentPath === route || currentPath.startsWith(route + '/'),
    )

    console.log('[Team Auth] Public mode - Route analysis:', {
      isProtectedRoute,
      isExplicitlyPublic,
      currentUser: currentUser.value ? 'logged in' : 'not logged in'
    })

    if (isExplicitlyPublic) {
      console.log('[Team Auth] Allowing explicitly public route:', currentPath)
      return
    }

    // Require authentication only for explicitly protected routes
    if (isProtectedRoute && !currentUser.value) {
      console.log('[Team Auth] Redirecting from protected route to login:', currentPath)
      const redirectUrl = `${currentPath}${to.search || ''}`
      const loginPage = teamAuthConfig.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }

    // For public routes (non-protected), return early after security checks
    if (!isProtectedRoute) {
      console.log('[Team Auth] Allowing non-protected route (public by default):', currentPath)
      // Still run critical security checks even for public routes
      if (isImpersonating.value && currentPath.startsWith('/admin/') && !currentPath.includes('/impersonate/stop')) {
        return navigateTo('/dashboard?error=admin_blocked_during_impersonation')
      }

      if (currentPath.includes('/admin/impersonate') || currentPath.includes('/impersonate')) {
        if (currentRole.value !== 'super_admin') {
          return navigateTo('/dashboard?error=insufficient_permissions')
        }
      }

      // Public routes skip all other auth/team checks
      return
    }

    // If we reach here, route is protected - continue to team/role validation
  }
  else {
    // Protected by default - only allow routes explicitly listed in publicRoutes
    const isExplicitlyPublic = configuredPublicRoutes.some(route =>
      currentPath === route || currentPath.startsWith(route + '/'),
    )

    console.log('[Team Auth] Protected mode - Route analysis:', {
      isExplicitlyPublic,
      currentUser: currentUser.value ? 'logged in' : 'not logged in'
    })

    if (isExplicitlyPublic) {
      console.log('[Team Auth] Allowing explicitly public route (protected mode):', currentPath)
      return
    }

    // All other routes require authentication in protected mode
    if (!currentUser.value) {
      console.log('[Team Auth] Redirecting to login (protected mode):', currentPath)
      const redirectUrl = `${currentPath}${to.search || ''}`
      const loginPage = teamAuthConfig.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }
  }

  // Handle impersonation restrictions
  if (isImpersonating.value) {
    // Block admin routes during impersonation (except stop impersonation)
    if (currentPath.startsWith('/admin/') && !currentPath.includes('/impersonate/stop')) {
      return navigateTo('/dashboard?error=admin_blocked_during_impersonation')
    }
  }

  // Handle super admin impersonation routes
  if (currentPath.includes('/admin/impersonate') || currentPath.includes('/impersonate')) {
    if (currentRole.value !== 'super_admin') {
      return navigateTo('/dashboard?error=insufficient_permissions')
    }
  }

  // Handle data integrity check: users should always have a team
  // This should never happen in single-team model, but guard against data corruption
  if (currentUser.value && !currentTeam.value) {
    console.error('[Team Auth] User exists without team - data integrity issue. User ID:', currentUser.value.id)
    return navigateTo('/signin?error=account_misconfigured')
  }
})

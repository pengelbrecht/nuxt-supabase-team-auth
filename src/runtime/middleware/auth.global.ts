import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'

/**
 * Global authentication middleware
 * Runs on every route change to ensure proper authentication state
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // During SSR, ensure authentication state is properly handled
  // On server-side, we might not have complete auth state yet
  const isSSR = import.meta.server

  const { currentUser, currentTeam, isLoading } = useTeamAuth()

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

  // Always allow access to auth routes and root
  const alwaysPublicRoutes = ['/', ...authRoutes]
  const isAlwaysPublic = alwaysPublicRoutes.some(route =>
    currentPath === route || currentPath.startsWith(route + '/'),
  )

  if (isAlwaysPublic) {
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

    if (isExplicitlyPublic) {
      return
    }

    // For public routes (non-protected), return early - this must come FIRST
    if (!isProtectedRoute) {
      // Public routes skip ALL auth/team validation checks (including data integrity)
      return
    }

    // For SSR: if auth is still loading and route is protected, allow access initially
    // The client-side middleware will re-run with proper auth state after hydration
    if (isSSR && isLoading.value && isProtectedRoute) {
      return
    }

    // Require authentication only for explicitly protected routes
    if (!currentUser.value) {
      const redirectUrl = `${currentPath}${to.search || ''}`
      const loginPage = teamAuthConfig.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }

    // If we reach here, route is protected - continue to team/role validation
  }
  else {
    // Protected by default - only allow routes explicitly listed in publicRoutes
    const isExplicitlyPublic = configuredPublicRoutes.some(route =>
      currentPath === route || currentPath.startsWith(route + '/'),
    )

    if (isExplicitlyPublic) {
      // Public routes skip ALL auth/team validation checks (including data integrity)
      return
    }

    // All other routes require authentication in protected mode
    if (!currentUser.value) {
      const redirectUrl = `${currentPath}${to.search || ''}`
      const loginPage = teamAuthConfig.loginPage || '/signin'
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
    }
  }

  // Impersonation restrictions are handled by the impersonation system itself
  // via API endpoints, not frontend route middleware

  // Handle data integrity check: users should always have a team
  // This should never happen in single-team model, but guard against data corruption
  if (currentUser.value && !currentTeam.value) {
    console.error('[Team Auth] REDIRECT POINT 3: User exists without team - data integrity issue. User ID:', currentUser.value.id)
    return navigateTo('/signin?error=account_misconfigured')
  }
})

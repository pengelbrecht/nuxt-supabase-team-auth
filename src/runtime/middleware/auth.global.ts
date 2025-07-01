import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#app'

/**
 * Global authentication middleware
 * Runs on every route change to ensure proper authentication state
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server-side rendering for performance
  if (import.meta.server) return

  const { currentUser, currentTeam, currentRole, isLoading, isImpersonating } = useTeamAuth()

  // More efficient auth loading wait with early exit
  if (isLoading.value) {
    // Use a shorter timeout with more frequent checks for better responsiveness
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max (20 * 100ms)

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++

      // Early exit if we have enough data for basic routing decisions
      if (currentUser.value !== undefined) {
        break
      }
    }

    // If still loading after timeout, proceed anyway to avoid hanging
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

  // Build final route lists based on protection mode
  let protectedRoutes: string[]
  let publicRoutes: string[]

  if (defaultProtection === 'public') {
    // Public by default - only specific routes are protected
    protectedRoutes = configuredProtectedRoutes
    publicRoutes = ['/', ...authRoutes, ...configuredPublicRoutes]
  }
  else {
    // Protected by default - specific routes are public
    protectedRoutes = ['/dashboard', '/team', '/teams', '/admin', '/profile', '/settings']
    publicRoutes = ['/', ...authRoutes, ...configuredPublicRoutes]
  }

  const currentPath = to.path

  // Debug logging for auth middleware
  if (currentPath.includes('/auth/')) {
    console.log('[Auth Middleware] Path:', currentPath)
    console.log('[Auth Middleware] Checking public routes:', publicRoutes)
  }

  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route =>
    currentPath === route || currentPath.startsWith(route + '/'),
  )

  // Debug logging for auth middleware
  if (currentPath.includes('/auth/')) {
    console.log('[Auth Middleware] isPublicRoute:', isPublicRoute)
  }

  // Allow access to public routes
  if (isPublicRoute) {
    if (currentPath.includes('/auth/')) {
      console.log('[Auth Middleware] Allowing public route:', currentPath)
    }
    return
  }

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    currentPath.startsWith(route),
  )

  // Require authentication for protected routes
  if (isProtectedRoute && !currentUser.value) {
    const redirectUrl = `${currentPath}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
    const loginPage = teamAuthConfig.loginPage || '/signin'
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`)
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

  // Handle team-specific routes
  if (currentPath.startsWith('/teams/') && currentPath !== '/teams') {
    const teamIdFromRoute = currentPath.split('/teams/')[1]?.split('/')[0]

    if (teamIdFromRoute && currentTeam.value?.id !== teamIdFromRoute) {
      return navigateTo('/teams?error=unauthorized_team_access')
    }
  }

  // Handle routes that require team membership
  const teamRequiredRoutes = ['/team/', '/dashboard']
  const requiresTeam = teamRequiredRoutes.some(route => currentPath.startsWith(route))

  if (requiresTeam && currentUser.value && !currentTeam.value) {
    return navigateTo('/teams?message=select_team_first')
  }
})

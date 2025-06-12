import { navigateTo } from '#app'
import { useTeamAuth } from '../composables/useTeamAuth'

/**
 * Global authentication middleware
 * Runs on every route change to ensure proper authentication state
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server-side rendering for performance
  if (process.server) return

  const { currentUser, currentTeam, currentRole, isLoading, isImpersonating } = useTeamAuth()

  // Wait for auth state to load
  if (isLoading.value) {
    // Wait for a reasonable time for auth to load
    let attempts = 0
    while (isLoading.value && attempts < 50) { // 5 seconds max
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }

  // Define protected route patterns
  const protectedRoutes = [
    '/dashboard',
    '/team',
    '/teams',
    '/admin',
    '/profile',
    '/settings'
  ]

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/auth',
    '/confirm',
    '/reset-password',
    '/about',
    '/contact',
    '/privacy',
    '/terms'
  ]

  const currentPath = to.path

  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => 
    currentPath === route || currentPath.startsWith(route + '/')
  )

  // Allow access to public routes
  if (isPublicRoute) {
    return
  }

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    currentPath.startsWith(route)
  )

  // Require authentication for protected routes
  if (isProtectedRoute && !currentUser.value) {
    const redirectUrl = `${currentPath}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
    return navigateTo(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
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
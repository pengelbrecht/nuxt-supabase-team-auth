import { useTeamAuth } from '../composables/useTeamAuth'
import { useSupabaseUser } from '../composables/useSupabaseComposables'
import { isServerRender } from '../utils/ssr'
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Global authentication middleware
 * Runs on every route change to ensure proper authentication state
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const isSSR = isServerRender()

  const { currentUser, currentTeam, isLoading } = useTeamAuth()

  // During SSR, use Supabase's SSR-aware user state from cookies.
  // @nuxtjs/supabase's server plugin resolves it before route middleware run.
  const supabaseUser = isSSR ? useSupabaseUser() : null

  // Get route protection config from runtime config
  const config = useRuntimeConfig()
  const teamAuthConfig = config.public.teamAuth || {}

  const defaultProtection = teamAuthConfig.defaultProtection || 'public'
  const configuredProtectedRoutes: string[] = teamAuthConfig.protectedRoutes || ['/dashboard']
  const configuredPublicRoutes: string[] = teamAuthConfig.publicRoutes || []
  const loginPage = teamAuthConfig.loginPage || '/signin'

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
  const matchesAny = (routes: string[]) => routes.some(route =>
    currentPath === route || currentPath.startsWith(route + '/'),
  )

  // Classify the route before waiting for auth state: public routes never
  // look at auth state, so they must not pay for the wait.

  // Always allow access to auth routes and root
  if (matchesAny(['/', ...authRoutes])) {
    return
  }

  // Public routes skip ALL auth/team validation checks (including data integrity)
  if (matchesAny(configuredPublicRoutes)) {
    return
  }

  // Public by default - only protect routes explicitly listed in protectedRoutes.
  // Protected by default - every remaining route requires authentication.
  if (defaultProtection === 'public' && !matchesAny(configuredProtectedRoutes)) {
    return
  }

  const redirectToLogin = () =>
    navigateTo(`${loginPage}?redirect=${encodeURIComponent(to.fullPath)}`)

  // Server: decide from the cookie-based Supabase user and never wait.
  // `isLoading` is only cleared by the client-side initializeAuth(), so on the
  // server it stays true for the whole request; waiting on it delayed every
  // SSR response by the full timeout. The team-auth state (and with it the
  // team/data-integrity check below) only exists on the client, which runs
  // this middleware again on hydration.
  if (isSSR) {
    if (!supabaseUser?.value) {
      return redirectToLogin()
    }
    return
  }

  // Client: wait for the initial auth resolution to complete (success or
  // confirmed-no-session) before deciding whether to redirect. Poll
  // `isLoading` only — an earlier version also broke out on
  // `currentUser.value !== undefined`, but `currentUser` starts as
  // `null` during hydration on a hard nav, so that check fired on the
  // first tick and redirected authenticated users to /login. See gh#52.
  if (isLoading.value) {
    let attempts = 0
    const maxAttempts = 20 // 2 seconds max (20 × 100ms)

    while (isLoading.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }

    if (isLoading.value && attempts >= maxAttempts) {
      console.warn('[Team Auth] Auth loading timeout in middleware, proceeding anyway')
    }
  }

  // Require authentication for protected routes
  if (!currentUser.value) {
    return redirectToLogin()
  }

  // Impersonation restrictions are handled by the impersonation system itself
  // via API endpoints, not frontend route middleware

  // Handle data integrity check: users should always have a team
  // This should never happen in single-team model, but guard against data corruption
  if (!currentTeam.value) {
    console.error('[Team Auth] REDIRECT POINT 3: User exists without team - data integrity issue. User ID:', currentUser.value.id)
    return navigateTo(`${loginPage}?error=account_misconfigured`)
  }
})

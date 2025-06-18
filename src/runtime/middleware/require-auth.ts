import { useTeamAuth } from '../composables/useTeamAuth'
import { navigateTo } from '#app'

/**
 * Middleware to require user authentication
 * Redirects to login if user is not authenticated
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, isLoading } = useTeamAuth()

  // Wait for auth state to load
  if (isLoading.value) {
    let attempts = 0
    while (isLoading.value && attempts < 50) { // 5 seconds max
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }

  // Redirect to login if not authenticated
  if (!currentUser.value) {
    const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ''}`
    return navigateTo(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }
})

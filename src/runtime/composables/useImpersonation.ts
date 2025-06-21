import { ref, computed, readonly, onUnmounted, getCurrentInstance } from 'vue'
import type { SupabaseClient } from '@supabase/supabase-js'

const IMPERSONATION_STORAGE_KEY = 'team_auth_impersonation'

interface ImpersonationData {
  sessionId: string
  originalAccessToken: string
  originalRefreshToken: string
  targetUser: {
    id: string
    email: string
    full_name: string
    role: string
    team: {
      id: string
      name: string
    }
  }
  expiresAt: string
}

// Global state for impersonation
const impersonationData = ref<ImpersonationData | null>(null)
const isStarting = ref(false)
const isStopping = ref(false)
const justStartedImpersonation = ref(false) // Flag for UI to react to successful start

// Initialize from storage on first load
if (import.meta.client && !impersonationData.value) {
  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored) as ImpersonationData
      // Check if not expired
      if (new Date(data.expiresAt) > new Date()) {
        impersonationData.value = data
      }
      else {
        // Clean up expired data
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
      }
    }
  }
  catch (error) {
    console.error('Failed to load impersonation data:', error)
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
  }
}

export function useImpersonation() {
  const nuxtApp = useNuxtApp()
  const toast = useToast()

  // Get Supabase client
  const getSupabaseClient = (): SupabaseClient => {
    if (!nuxtApp?.$teamAuthClient) {
      throw new Error('Supabase client not available')
    }
    return nuxtApp.$teamAuthClient as SupabaseClient
  }

  // Computed state
  const isImpersonating = computed(() => !!impersonationData.value)
  const impersonatedUser = computed(() => impersonationData.value?.targetUser || null)
  const impersonationExpiresAt = computed(() =>
    impersonationData.value ? new Date(impersonationData.value.expiresAt) : null,
  )

  // Start impersonation
  const startImpersonation = async (targetUserId: string, reason: string) => {
    if (isStarting.value || isImpersonating.value) {
      return
    }

    try {
      isStarting.value = true
      const supabase = getSupabaseClient()

      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('No active session')
      }

      // Call server endpoint
      const response = await $fetch('/api/impersonate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: {
          targetUserId,
          reason,
        },
      })

      if (!response.success || !response.session || !response.impersonation) {
        console.error('Invalid response structure:', response)
        throw new Error('Invalid impersonation response')
      }

      // Store impersonation data
      const data: ImpersonationData = {
        sessionId: response.impersonation.session_id,
        originalAccessToken: response.originalSession.access_token,
        originalRefreshToken: currentSession.refresh_token,
        targetUser: response.impersonation.target_user,
        expiresAt: response.impersonation.expires_at,
      }

      impersonationData.value = data
      localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(data))

      // Clear the loading state immediately since we got a successful response
      isStarting.value = false

      // Try to set the session, but don't let it block the UI
      const sessionPromise = supabase.auth.setSession({
        access_token: response.session.access_token,
        refresh_token: response.session.refresh_token,
      })

      // Add timeout to prevent hanging (longer timeout for impersonation)
      Promise.race([
        sessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 8000)),
      ]).then(
        (_result: any) => {
          // Session set successfully - auth listener will handle state update
        },
        (error) => {
          // Only warn if it's not a timeout - timeouts are expected during impersonation
          if (!error.message.includes('timeout')) {
            console.warn('Session setting failed:', error)
          }
          // The auth state will be updated by the auth listener when the session is ready
        },
      )

      toast.add({
        title: 'Impersonation Started',
        description: `Now impersonating ${data.targetUser.full_name || data.targetUser.email}`,
        color: 'blue',
        icon: 'i-lucide-user-check',
      })

      // Signal successful impersonation for UI components to react
      justStartedImpersonation.value = true

      // Let the auth listener handle the state update naturally
    }
    catch (error: unknown) {
      console.error('Failed to start impersonation:', error)
      const errorObj = error as any
      toast.add({
        title: 'Impersonation Failed',
        description: errorObj.data?.message || errorObj.message || 'Failed to start impersonation',
        color: 'red',
        icon: 'i-lucide-alert-circle',
      })
      throw error
    }
    finally {
      // Only clear loading if we haven't already done it in success case
      if (isStarting.value) {
        isStarting.value = false
      }
    }
  }

  // Stop impersonation
  const stopImpersonation = async () => {
    if (isStopping.value || !isImpersonating.value || !impersonationData.value) {
      return
    }

    try {
      isStopping.value = true
      const supabase = getSupabaseClient()
      const data = impersonationData.value

      // Get current session (impersonated)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw new Error('No active session')
      }

      // Call stop endpoint
      console.log('Calling stop-impersonation API...')
      await $fetch('/api/stop-impersonation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: {
          sessionId: data.sessionId,
          originalAccessToken: data.originalAccessToken,
        },
      })
      console.log('Stop-impersonation API completed')

      // Restore original session
      await supabase.auth.setSession({
        access_token: data.originalAccessToken,
        refresh_token: data.originalRefreshToken,
      })

      // Clear impersonation data
      impersonationData.value = null
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY)

      toast.add({
        title: 'Impersonation Ended',
        description: 'Returned to your original session',
        color: 'green',
        icon: 'i-lucide-user-x',
      })

      // Reload to clean state
      try {
        await navigateTo('/dashboard', { external: true })
      }
      catch (navError) {
        // navigateTo might throw but that's expected during page reload
        console.log('Navigation during impersonation stop (expected):', navError)
      }
    }
    catch (error: unknown) {
      console.error('Failed to stop impersonation:', error)

      // Emergency cleanup
      impersonationData.value = null
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY)

      toast.add({
        title: 'Error Stopping Impersonation',
        description: 'Session has been cleared. Please sign in again.',
        color: 'red',
        icon: 'i-lucide-alert-circle',
      })

      // Force sign out as fallback
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
      const config = useRuntimeConfig()
      const loginPage = config.public.teamAuth?.loginPage || '/signin'
      await navigateTo(loginPage)
    }
    finally {
      isStopping.value = false
    }
  }

  // Check if impersonation is expired
  const checkExpiration = () => {
    if (impersonationData.value && new Date(impersonationData.value.expiresAt) <= new Date()) {
      toast.add({
        title: 'Impersonation Expired',
        description: 'Your impersonation session has expired',
        color: 'orange',
        icon: 'i-lucide-clock',
      })
      stopImpersonation()
    }
  }

  // Set up expiration check interval
  if (import.meta.client) {
    const interval = setInterval(checkExpiration, 30000) // Check every 30 seconds

    // Clean up on unmount
    if (getCurrentInstance()) {
      onUnmounted(() => clearInterval(interval))
    }
  }

  // Helper to clear the success flag (for UI components)
  const clearSuccessFlag = () => {
    justStartedImpersonation.value = false
  }

  return {
    // State
    isImpersonating: readonly(isImpersonating),
    impersonatedUser: readonly(impersonatedUser),
    impersonationExpiresAt: readonly(impersonationExpiresAt),
    isStarting: readonly(isStarting),
    isStopping: readonly(isStopping),
    justStartedImpersonation: readonly(justStartedImpersonation),

    // Actions
    startImpersonation,
    stopImpersonation,
    clearSuccessFlag,
  }
}

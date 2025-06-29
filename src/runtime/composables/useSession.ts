import { ref, readonly } from 'vue'
import { useSupabaseClient } from '#imports'
// Use any for Session type since we'll get it from @nuxtjs/supabase
type Session = any

// Global session state
const sessionCache = ref<Session | null>(null)
const sessionPromise = ref<Promise<Session | null> | null>(null)
const lastFetch = ref(0)
const CACHE_DURATION = 30000 // 30 seconds

// Cache the Supabase client to avoid repeated calls
let cachedClient: any = null
let authListener: any = null

function getClient() {
  if (!cachedClient) {
    cachedClient = useSupabaseClient()
    if (!cachedClient) {
      throw new Error('useSupabaseClient() returned undefined - check your Supabase setup')
    }
  }
  return cachedClient
}

// Set up auth state listener to invalidate cache on session changes
function setupAuthListener() {
  if (authListener || !import.meta.client) return

  try {
    const client = getClient()
    authListener = client.auth.onAuthStateChange((event: string, session: Session | null) => {
      // Clear cache whenever auth state changes (including impersonation)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        sessionCache.value = session
        lastFetch.value = Date.now()
      }
    })
  }
  catch {
    // Client not ready yet, will be set up on first getSession call
    console.debug('Auth listener setup deferred - client not ready')
  }
}

/**
 * Centralized session management composable
 * Provides cached session access and prevents concurrent getSession() calls
 */
export function useSession() {
  /**
   * Get the current session with intelligent caching
   * @param force - Force a fresh session fetch, bypassing cache
   * @returns Session object or null
   */
  const getSession = async (force = false): Promise<Session | null> => {
    // Set up auth listener on first use if not already done
    if (!authListener && import.meta.client) {
      setupAuthListener()
    }

    const now = Date.now()

    // Return cached session if recent and not forcing refresh
    if (!force && sessionCache.value && (now - lastFetch.value) < CACHE_DURATION) {
      return sessionCache.value
    }

    // Prevent concurrent session fetches by reusing existing promise
    if (sessionPromise.value) {
      return await sessionPromise.value
    }

    // Create new session fetch promise
    sessionPromise.value = fetchSession()

    try {
      const result = await sessionPromise.value
      return result
    }
    finally {
      // Clear the promise after completion (success or failure)
      sessionPromise.value = null
    }
  }

  /**
   * Internal function to actually fetch the session
   */
  const fetchSession = async (): Promise<Session | null> => {
    try {
      const { data: { session }, error } = await getClient().auth.getSession()

      if (error) {
        console.warn('Session fetch error:', error)
        return null
      }

      // Update cache
      sessionCache.value = session
      lastFetch.value = Date.now()

      return session
    }
    catch (error) {
      console.error('Failed to fetch session:', error)
      return null
    }
  }

  /**
   * Clear the session cache (useful for logout scenarios)
   */
  const clearSession = () => {
    sessionCache.value = null
    lastFetch.value = 0
    sessionPromise.value = null
  }

  /**
   * Invalidate cache and force fresh session fetch
   * Useful for impersonation or other session state changes
   */
  const invalidateSession = async () => {
    clearSession()
    return await getSession(true)
  }

  /**
   * Get cached session without fetching (may be null/stale)
   */
  const getCachedSession = () => sessionCache.value

  /**
   * Check if we have a valid cached session
   */
  const hasCachedSession = () => {
    const now = Date.now()
    return sessionCache.value && (now - lastFetch.value) < CACHE_DURATION
  }

  return {
    getSession,
    clearSession,
    invalidateSession,
    getCachedSession,
    hasCachedSession,
    // Expose readonly cache for reactive use
    sessionCache: readonly(sessionCache),
  }
}

/**
 * Reset all global session state - for testing only
 * @internal
 */
export function resetSessionState() {
  sessionCache.value = null
  sessionPromise.value = null
  lastFetch.value = 0
  cachedClient = null
  if (authListener) {
    // Clean up auth listener if it exists
    if (typeof authListener === 'function') {
      authListener()
    }
    else if (authListener?.unsubscribe) {
      authListener.unsubscribe()
    }
    authListener = null
  }
}

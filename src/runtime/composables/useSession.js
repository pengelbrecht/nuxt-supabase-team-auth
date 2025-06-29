import { ref, readonly } from "vue";
const sessionCache = ref(null);
const sessionPromise = ref(null);
const lastFetch = ref(0);
const CACHE_DURATION = 3e4;
let cachedClient = null;
let authListener = null;
function getClient() {
  if (!cachedClient) {
    cachedClient = useSupabaseClient();
    if (!cachedClient) {
      throw new Error("useSupabaseClient() returned undefined - check your Supabase setup");
    }
  }
  return cachedClient;
}
function setupAuthListener() {
  if (authListener || !import.meta.client) return;
  try {
    const client = getClient();
    authListener = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        sessionCache.value = session;
        lastFetch.value = Date.now();
      }
    });
  } catch {
    console.debug("Auth listener setup deferred - client not ready");
  }
}
export function useSession() {
  const getSession = async (force = false) => {
    if (!authListener && import.meta.client) {
      setupAuthListener();
    }
    const now = Date.now();
    if (!force && sessionCache.value && now - lastFetch.value < CACHE_DURATION) {
      return sessionCache.value;
    }
    if (sessionPromise.value) {
      return await sessionPromise.value;
    }
    sessionPromise.value = fetchSession();
    try {
      const result = await sessionPromise.value;
      return result;
    } finally {
      sessionPromise.value = null;
    }
  };
  const fetchSession = async () => {
    try {
      const { data: { session }, error } = await getClient().auth.getSession();
      if (error) {
        console.warn("Session fetch error:", error);
        return null;
      }
      sessionCache.value = session;
      lastFetch.value = Date.now();
      return session;
    } catch (error) {
      console.error("Failed to fetch session:", error);
      return null;
    }
  };
  const clearSession = () => {
    sessionCache.value = null;
    lastFetch.value = 0;
    sessionPromise.value = null;
  };
  const invalidateSession = async () => {
    clearSession();
    return await getSession(true);
  };
  const getCachedSession = () => sessionCache.value;
  const hasCachedSession = () => {
    const now = Date.now();
    return sessionCache.value && now - lastFetch.value < CACHE_DURATION;
  };
  return {
    getSession,
    clearSession,
    invalidateSession,
    getCachedSession,
    hasCachedSession,
    // Expose readonly cache for reactive use
    sessionCache: readonly(sessionCache)
  };
}
export function resetSessionState() {
  sessionCache.value = null;
  sessionPromise.value = null;
  lastFetch.value = 0;
  cachedClient = null;
  if (authListener) {
    if (typeof authListener === "function") {
      authListener();
    } else if (authListener?.unsubscribe) {
      authListener.unsubscribe();
    }
    authListener = null;
  }
}

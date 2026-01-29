import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { User, Team } from '../types'

/**
 * Enhanced cross-tab synchronization for team-specific session data
 * Builds on top of Supabase's built-in auth state sync
 */

interface TeamSessionState {
  currentUser: User | null
  currentTeam: Team | null
  currentRole: string | null
  isImpersonating: boolean
  impersonationExpiresAt: string | null
  lastUpdated: string
  tabId: string
}

type SessionSyncEventType
  = | 'team_changed'
    | 'role_changed'
    | 'impersonation_started'
    | 'impersonation_stopped'
    | 'session_conflict'
    | 'session_recovery'

interface SessionSyncEvents {
  TEAM_CHANGED: 'team_changed'
  ROLE_CHANGED: 'role_changed'
  IMPERSONATION_STARTED: 'impersonation_started'
  IMPERSONATION_STOPPED: 'impersonation_stopped'
  SESSION_CONFLICT: 'session_conflict'
  SESSION_RECOVERY: 'session_recovery'
}

const SESSION_SYNC_EVENTS: SessionSyncEvents = {
  TEAM_CHANGED: 'team_changed',
  ROLE_CHANGED: 'role_changed',
  IMPERSONATION_STARTED: 'impersonation_started',
  IMPERSONATION_STOPPED: 'impersonation_stopped',
  SESSION_CONFLICT: 'session_conflict',
  SESSION_RECOVERY: 'session_recovery',
}

interface ActiveTab {
  tabId: string
  timestamp: number
}

const STORAGE_KEYS = {
  TEAM_SESSION_STATE: 'team_auth_session_sync',
  ACTIVE_TABS: 'team_auth_active_tabs',
  IMPERSONATION_LOCK: 'team_auth_impersonation_lock',
}

export function useSessionSync() {
  const tabId = ref<string>(generateTabId())
  const isActiveTab = ref<boolean>(true)
  const lastSyncTime = ref<Date>(new Date())
  const conflictResolution = ref<'primary' | 'secondary' | 'conflict'>('primary')

  // Generate unique tab identifier
  function generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Get current team session state
  function getCurrentSessionState(
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ): TeamSessionState {
    return {
      currentUser: currentUser.value,
      currentTeam: currentTeam.value,
      currentRole: currentRole.value,
      isImpersonating: isImpersonating.value,
      impersonationExpiresAt: impersonationExpiresAt.value?.toISOString() || null,
      lastUpdated: new Date().toISOString(),
      tabId: tabId.value,
    }
  }

  // Store session state for cross-tab sync
  function broadcastSessionState(state: TeamSessionState, eventType: SessionSyncEventType) {
    try {
      if (typeof window === 'undefined') return

      const syncData = {
        event: eventType,
        state,
        timestamp: Date.now(),
        sourceTab: tabId.value,
      }

      localStorage.setItem(STORAGE_KEYS.TEAM_SESSION_STATE, JSON.stringify(syncData))
      lastSyncTime.value = new Date()

      // Trigger storage event by removing and re-setting (for same-tab detection)
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.TEAM_SESSION_STATE)
      }, 100)
    }
    catch (error) {
      console.error('Failed to broadcast session state:', error)
    }
  }

  // Listen for session state changes from other tabs
  function setupCrossTabListener(
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
    onStateUpdate: (state: TeamSessionState, eventType: SessionSyncEventType) => void,
  ) {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.TEAM_SESSION_STATE || !event.newValue) {
        return
      }

      try {
        const syncData = JSON.parse(event.newValue)

        // Ignore events from the same tab
        if (syncData.sourceTab === tabId.value) {
          return
        }

        // Check if this is a recent event (within 5 seconds)
        const eventAge = Date.now() - syncData.timestamp
        if (eventAge > 5000) {
          return
        }

        // Handle different event types
        switch (syncData.event) {
          case SESSION_SYNC_EVENTS.TEAM_CHANGED:
            handleTeamChange(syncData.state, currentUser, currentTeam, currentRole)
            break

          case SESSION_SYNC_EVENTS.ROLE_CHANGED:
            handleRoleChange(syncData.state, currentRole)
            break

          case SESSION_SYNC_EVENTS.IMPERSONATION_STARTED:
            handleImpersonationStart(syncData.state, isImpersonating, impersonationExpiresAt)
            break

          case SESSION_SYNC_EVENTS.IMPERSONATION_STOPPED:
            handleImpersonationStop(isImpersonating, impersonationExpiresAt)
            break

          case SESSION_SYNC_EVENTS.SESSION_RECOVERY:
            handleSessionRecovery(syncData.state, currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
            break
        }

        onStateUpdate(syncData.state, syncData.event)
      }
      catch (error) {
        console.error('Failed to handle cross-tab session sync:', error)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }

  // Handle team change sync
  function handleTeamChange(
    state: TeamSessionState,
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
  ) {
    // Only sync if the user is the same
    if (currentUser.value?.id === state.currentUser?.id) {
      currentTeam.value = state.currentTeam
      currentRole.value = state.currentRole
    }
  }

  // Handle role change sync
  function handleRoleChange(state: TeamSessionState, currentRole: Ref<string | null>) {
    currentRole.value = state.currentRole
  }

  // Handle impersonation start sync
  function handleImpersonationStart(
    state: TeamSessionState,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ) {
    // Check for impersonation conflicts
    if (isImpersonating.value && state.isImpersonating) {
      console.warn('Impersonation conflict detected across tabs')
      handleImpersonationConflict(state)
      return
    }

    isImpersonating.value = state.isImpersonating
    impersonationExpiresAt.value = state.impersonationExpiresAt ? new Date(state.impersonationExpiresAt) : null
  }

  // Handle impersonation stop sync
  function handleImpersonationStop(
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ) {
    isImpersonating.value = false
    impersonationExpiresAt.value = null
  }

  // Handle session recovery
  function handleSessionRecovery(
    state: TeamSessionState,
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ) {
    // Full state recovery from a healthy tab
    currentUser.value = state.currentUser
    currentTeam.value = state.currentTeam
    currentRole.value = state.currentRole
    isImpersonating.value = state.isImpersonating
    impersonationExpiresAt.value = state.impersonationExpiresAt ? new Date(state.impersonationExpiresAt) : null
  }

  // Handle impersonation conflicts
  function handleImpersonationConflict(conflictState: TeamSessionState) {
    try {
      // Create a lock to resolve conflicts
      const lockData = {
        tabId: tabId.value,
        timestamp: Date.now(),
        action: 'resolving_conflict',
      }

      localStorage.setItem(STORAGE_KEYS.IMPERSONATION_LOCK, JSON.stringify(lockData))

      // The tab with the newer impersonation session wins
      const conflictTime = new Date(conflictState.lastUpdated).getTime()
      const currentTime = Date.now()

      if (conflictTime > currentTime - 1000) { // Within 1 second = conflict state wins
        conflictResolution.value = 'secondary'
        console.info('Impersonation conflict resolved: deferring to newer session')
      }
      else {
        conflictResolution.value = 'primary'
        console.info('Impersonation conflict resolved: maintaining current session')
      }

      // Clean up lock after resolution
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.IMPERSONATION_LOCK)
      }, 1000)
    }
    catch (error) {
      console.error('Failed to resolve impersonation conflict:', error)
      conflictResolution.value = 'conflict'
    }
  }

  // Register this tab as active
  function registerActiveTab() {
    try {
      if (typeof window === 'undefined') return

      const activeTabs = getActiveTabs()
      activeTabs.push({
        tabId: tabId.value,
        timestamp: Date.now(),
        url: window.location.href,
      })

      localStorage.setItem(STORAGE_KEYS.ACTIVE_TABS, JSON.stringify(activeTabs))
    }
    catch (error) {
      console.error('Failed to register active tab:', error)
    }
  }

  // Unregister this tab
  function unregisterActiveTab() {
    try {
      if (typeof window === 'undefined') return

      const activeTabs = getActiveTabs().filter((tab: ActiveTab) => tab.tabId !== tabId.value)
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TABS, JSON.stringify(activeTabs))
    }
    catch (error) {
      console.error('Failed to unregister active tab:', error)
    }
  }

  // Get list of active tabs
  function getActiveTabs() {
    try {
      if (typeof window === 'undefined') return []

      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_TABS)
      if (!stored) return []

      const tabs = JSON.parse(stored)
      const now = Date.now()

      // Filter out tabs older than 5 minutes (likely closed)
      return tabs.filter((tab: any) => now - tab.timestamp < 5 * 60 * 1000)
    }
    catch (error) {
      console.error('Failed to get active tabs:', error)
      return []
    }
  }

  // Check if this is the primary tab (oldest active tab)
  function isPrimaryTab(): boolean {
    if (typeof window === 'undefined') return true

    const activeTabs = getActiveTabs()
    if (activeTabs.length === 0) return true

    // Sort by timestamp and check if we're the oldest
    activeTabs.sort((a: ActiveTab, b: ActiveTab) => a.timestamp - b.timestamp)
    return activeTabs[0].tabId === tabId.value
  }

  // Session health check
  function performSessionHealthCheck(
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ): { isHealthy: boolean, issues: string[] } {
    const issues: string[] = []

    // Check for basic session consistency
    if (currentUser.value && !currentTeam.value && !isImpersonating.value) {
      issues.push('User authenticated but no team selected')
    }

    if (currentTeam.value && !currentRole.value) {
      issues.push('Team selected but no role assigned')
    }

    // Check impersonation expiration
    if (isImpersonating.value && impersonationExpiresAt.value) {
      if (new Date() >= impersonationExpiresAt.value) {
        issues.push('Impersonation session expired')
      }
    }

    // Check for orphaned impersonation state
    if (isImpersonating.value && !impersonationExpiresAt.value) {
      issues.push('Impersonation state without expiration')
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    }
  }

  // Initialize session sync
  function initializeSessionSync(
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
    onStateUpdate: (state: TeamSessionState, eventType: SessionSyncEventType) => void = () => {},
  ) {
    // Skip initialization during SSR
    if (typeof window === 'undefined') {
      return () => {} // Return empty cleanup function
    }

    registerActiveTab()

    // Set up cross-tab listener
    const cleanup = setupCrossTabListener(
      currentUser,
      currentTeam,
      currentRole,
      isImpersonating,
      impersonationExpiresAt,
      onStateUpdate,
    )

    // Set up watchers for state changes
    const stopWatchers = [
      watch(currentTeam, (newTeam, oldTeam) => {
        if (newTeam?.id !== oldTeam?.id) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
          broadcastSessionState(state, SESSION_SYNC_EVENTS.TEAM_CHANGED)
        }
      }),

      watch(currentRole, (newRole, oldRole) => {
        if (newRole !== oldRole) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
          broadcastSessionState(state, SESSION_SYNC_EVENTS.ROLE_CHANGED)
        }
      }),

      watch(isImpersonating, (newValue, oldValue) => {
        if (newValue !== oldValue) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
          if (newValue) {
            broadcastSessionState(state, SESSION_SYNC_EVENTS.IMPERSONATION_STARTED)
          }
          else {
            broadcastSessionState(state, SESSION_SYNC_EVENTS.IMPERSONATION_STOPPED)
          }
        }
      }),
    ]

    // Set up periodic health checks
    const healthCheckInterval = setInterval(() => {
      const health = performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
      if (!health.isHealthy) {
        console.warn('Session health issues detected:', health.issues)
        // Optionally trigger recovery mechanisms here
      }
    }, 60000) // Check every minute

    // Cleanup function
    return () => {
      unregisterActiveTab()
      cleanup()
      stopWatchers.forEach(stop => stop())
      clearInterval(healthCheckInterval)
    }
  }

  // Manual session recovery trigger
  function triggerSessionRecovery(
    currentUser: Ref<User | null>,
    currentTeam: Ref<Team | null>,
    currentRole: Ref<string | null>,
    isImpersonating: Ref<boolean>,
    impersonationExpiresAt: Ref<Date | null>,
  ) {
    const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt)
    broadcastSessionState(state, SESSION_SYNC_EVENTS.SESSION_RECOVERY)
  }

  return {
    // State
    tabId: tabId.value,
    isActiveTab,
    isPrimaryTab: isPrimaryTab(),
    lastSyncTime,
    conflictResolution,

    // Methods
    initializeSessionSync,
    broadcastSessionState,
    triggerSessionRecovery,
    performSessionHealthCheck,
    getActiveTabs,

    // Constants
    SESSION_SYNC_EVENTS,
  }
}

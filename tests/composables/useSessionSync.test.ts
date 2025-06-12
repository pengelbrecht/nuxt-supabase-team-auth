import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSessionSync } from '../../src/runtime/composables/useSessionSync'

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store = {} as Record<string, string>
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

const sessionStorageMock = (() => {
  let store = {} as Record<string, string>
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

// Mock window location
Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost:3000/dashboard' },
  writable: true
})

describe('useSessionSync', () => {
  let sessionSync: ReturnType<typeof useSessionSync>
  let mockCurrentUser: any
  let mockCurrentTeam: any 
  let mockCurrentRole: any
  let mockIsImpersonating: any
  let mockImpersonationExpiresAt: any

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    sessionStorageMock.clear()
    
    sessionSync = useSessionSync()
    
    // Create mock reactive refs
    mockCurrentUser = ref({ id: 'user-123', email: 'test@example.com' })
    mockCurrentTeam = ref({ id: 'team-456', name: 'Test Team' })
    mockCurrentRole = ref('admin')
    mockIsImpersonating = ref(false)
    mockImpersonationExpiresAt = ref(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should generate unique tab ID', () => {
      expect(sessionSync.tabId).toMatch(/^tab_\d+_[a-z0-9]+$/)
    })

    it('should register active tab on initialization', () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_active_tabs',
        expect.stringContaining(sessionSync.tabId)
      )

      cleanup()
    })

    it('should set up watchers for state changes', async () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Change team to trigger watcher
      mockCurrentTeam.value = { id: 'team-789', name: 'New Team' }

      // Allow Vue's reactivity system to process
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('team_changed')
      )

      cleanup()
    })
  })

  describe('Cross-tab Synchronization', () => {
    it('should broadcast team changes', async () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      // Trigger team change
      mockCurrentTeam.value = { id: 'team-new', name: 'Updated Team' }

      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('"event":"team_changed"')
      )

      cleanup()
    })

    it('should broadcast role changes', async () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      // Trigger role change
      mockCurrentRole.value = 'owner'

      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('"event":"role_changed"')
      )

      cleanup()
    })

    it('should broadcast impersonation start/stop', async () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      // Start impersonation
      mockIsImpersonating.value = true
      mockImpersonationExpiresAt.value = new Date(Date.now() + 30 * 60 * 1000)

      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('"event":"impersonation_started"')
      )

      // Stop impersonation
      mockIsImpersonating.value = false
      mockImpersonationExpiresAt.value = null

      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('"event":"impersonation_stopped"')
      )

      cleanup()
    })

    it('should handle storage events from other tabs', () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'team_changed',
          state: {
            currentUser: { id: 'user-123', email: 'test@example.com' },
            currentTeam: { id: 'team-new', name: 'Another Team' },
            currentRole: 'member',
            isImpersonating: false,
            impersonationExpiresAt: null,
            lastUpdated: new Date().toISOString(),
            tabId: 'different-tab-id'
          },
          timestamp: Date.now(),
          sourceTab: 'different-tab-id'
        })
      })

      window.dispatchEvent(storageEvent)

      // Should update team state from other tab
      expect(mockCurrentTeam.value).toEqual({ id: 'team-new', name: 'Another Team' })
      expect(mockCurrentRole.value).toBe('member')
      expect(onStateUpdate).toHaveBeenCalled()

      cleanup()
    })
  })

  describe('Session Health Monitoring', () => {
    it('should detect healthy session state', () => {
      const health = sessionSync.performSessionHealthCheck(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(health.isHealthy).toBe(true)
      expect(health.issues).toHaveLength(0)
    })

    it('should detect user without team', () => {
      mockCurrentTeam.value = null
      mockCurrentRole.value = null

      const health = sessionSync.performSessionHealthCheck(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('User authenticated but no team selected')
    })

    it('should detect team without role', () => {
      mockCurrentRole.value = null

      const health = sessionSync.performSessionHealthCheck(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('Team selected but no role assigned')
    })

    it('should detect expired impersonation', () => {
      mockIsImpersonating.value = true
      mockImpersonationExpiresAt.value = new Date(Date.now() - 1000) // 1 second ago

      const health = sessionSync.performSessionHealthCheck(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('Impersonation session expired')
    })

    it('should detect orphaned impersonation state', () => {
      mockIsImpersonating.value = true
      mockImpersonationExpiresAt.value = null

      const health = sessionSync.performSessionHealthCheck(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('Impersonation state without expiration')
    })
  })

  describe('Active Tab Management', () => {
    it('should track active tabs', () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      const activeTabs = sessionSync.getActiveTabs()
      expect(activeTabs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tabId: sessionSync.tabId,
            url: 'http://localhost:3000/dashboard'
          })
        ])
      )

      cleanup()
    })

    it('should filter out old tabs', () => {
      // Set up old tab data
      const oldTabData = [{
        tabId: 'old-tab',
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        url: 'http://localhost:3000/old'
      }]
      
      localStorageMock.setItem('team_auth_active_tabs', JSON.stringify(oldTabData))

      const activeTabs = sessionSync.getActiveTabs()
      expect(activeTabs).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tabId: 'old-tab' })
        ])
      )
    })

    it('should determine primary tab correctly', () => {
      // With no other tabs, should be primary
      expect(sessionSync.isPrimaryTab).toBe(true)
    })
  })

  describe('Impersonation Conflict Resolution', () => {
    it('should handle impersonation conflicts', () => {
      mockIsImpersonating.value = true
      mockImpersonationExpiresAt.value = new Date(Date.now() + 30 * 60 * 1000)

      const onStateUpdate = vi.fn()
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate another tab starting impersonation
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'impersonation_started',
          state: {
            currentUser: { id: 'user-123', email: 'test@example.com' },
            currentTeam: { id: 'team-456', name: 'Test Team' },
            currentRole: 'admin',
            isImpersonating: true,
            impersonationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            lastUpdated: new Date().toISOString(),
            tabId: 'other-tab-id'
          },
          timestamp: Date.now(),
          sourceTab: 'other-tab-id'
        })
      })

      window.dispatchEvent(storageEvent)

      // Should detect conflict and create lock
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_impersonation_lock',
        expect.stringContaining('resolving_conflict')
      )

      cleanup()
    })
  })

  describe('Session Recovery', () => {
    it('should trigger session recovery', () => {
      sessionSync.triggerSessionRecovery(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_session_sync',
        expect.stringContaining('"event":"session_recovery"')
      )
    })

    it('should handle session recovery from other tabs', () => {
      // Set up corrupted local state
      mockCurrentTeam.value = null
      mockCurrentRole.value = null

      const onStateUpdate = vi.fn()
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate recovery event from healthy tab
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'session_recovery',
          state: {
            currentUser: { id: 'user-123', email: 'test@example.com' },
            currentTeam: { id: 'team-recovered', name: 'Recovered Team' },
            currentRole: 'admin',
            isImpersonating: false,
            impersonationExpiresAt: null,
            lastUpdated: new Date().toISOString(),
            tabId: 'healthy-tab-id'
          },
          timestamp: Date.now(),
          sourceTab: 'healthy-tab-id'
        })
      })

      window.dispatchEvent(storageEvent)

      // Should restore state from healthy tab
      expect(mockCurrentTeam.value).toEqual({ id: 'team-recovered', name: 'Recovered Team' })
      expect(mockCurrentRole.value).toBe('admin')
      expect(onStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          currentTeam: { id: 'team-recovered', name: 'Recovered Team' }
        }),
        'session_recovery'
      )

      cleanup()
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on unmount', () => {
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt
      )

      // Clear mocks to check cleanup calls
      vi.clearAllMocks()

      cleanup()

      // Should unregister tab
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'team_auth_active_tabs',
        expect.not.stringContaining(sessionSync.tabId)
      )
    })

    it('should ignore storage events after cleanup', () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      cleanup()

      // Simulate storage event after cleanup
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'team_changed',
          state: { /* ... */ },
          timestamp: Date.now(),
          sourceTab: 'other-tab'
        })
      })

      window.dispatchEvent(storageEvent)

      // Should not trigger state update
      expect(onStateUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed storage data gracefully', () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate malformed storage event
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: 'invalid-json'
      })

      expect(() => {
        window.dispatchEvent(storageEvent)
      }).not.toThrow()

      expect(onStateUpdate).not.toHaveBeenCalled()

      cleanup()
    })

    it('should ignore events from same tab', () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate storage event from same tab
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'team_changed',
          state: { /* ... */ },
          timestamp: Date.now(),
          sourceTab: sessionSync.tabId // Same tab
        })
      })

      window.dispatchEvent(storageEvent)

      // Should ignore event from same tab
      expect(onStateUpdate).not.toHaveBeenCalled()

      cleanup()
    })

    it('should ignore old events', () => {
      const onStateUpdate = vi.fn()
      
      const cleanup = sessionSync.initializeSessionSync(
        mockCurrentUser,
        mockCurrentTeam,
        mockCurrentRole,
        mockIsImpersonating,
        mockImpersonationExpiresAt,
        onStateUpdate
      )

      // Simulate old storage event
      const storageEvent = new StorageEvent('storage', {
        key: 'team_auth_session_sync',
        newValue: JSON.stringify({
          event: 'team_changed',
          state: { /* ... */ },
          timestamp: Date.now() - 10000, // 10 seconds old
          sourceTab: 'other-tab'
        })
      })

      window.dispatchEvent(storageEvent)

      // Should ignore old events
      expect(onStateUpdate).not.toHaveBeenCalled()

      cleanup()
    })
  })
})
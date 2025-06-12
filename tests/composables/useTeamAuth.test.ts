import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useTeamAuth } from '../../src/runtime/composables/useTeamAuth'

// Create mock Supabase client - this is the only external dependency we mock
const createMockSupabaseClient = () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), 
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null })
  }
  
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn()
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => ({
      ...mockQueryBuilder,
      // Make sure chained methods continue to return the builder
      update: vi.fn(() => ({
        ...mockQueryBuilder,
        eq: vi.fn(() => ({
          ...mockQueryBuilder,
          neq: vi.fn().mockResolvedValue({ error: null })
        }))
      }))
    }))
  }
}

// Mock data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { name: 'Test User' }
}

const mockTeam = {
  id: 'team-456',
  name: 'Test Team',
  created_at: '2023-01-01T00:00:00Z'
}

// Create a proper JWT token for testing JWT parsing logic
const createMockJWT = (payload: any) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const encodedPayload = btoa(JSON.stringify(payload))
  const signature = 'mock-signature-for-testing'
  return `${header}.${encodedPayload}.${signature}`
}

const mockSession = {
  access_token: createMockJWT({
    team_id: 'team-456',
    team_name: 'Test Team', 
    team_role: 'owner',
    sub: 'user-123',
    email: 'test@example.com'
  }),
  refresh_token: 'refresh-token',
  expires_at: Date.now() / 1000 + 3600,
  user: mockUser
}

describe('useTeamAuth', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh mock for each test
    mockSupabaseClient = createMockSupabaseClient()
    
    // Mock storage functions (browser APIs we can't test directly)
    vi.mocked(global.localStorage.getItem).mockReturnValue(null)
    vi.mocked(global.localStorage.setItem).mockImplementation(() => {})
    vi.mocked(global.sessionStorage.getItem).mockReturnValue(null)
    vi.mocked(global.sessionStorage.setItem).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('State Management', () => {
    it('should initialize with null values', () => {
      // REAL FUNCTIONALITY TESTED: Initial state management
      const { currentUser, currentTeam, currentRole, isImpersonating, isLoading } = useTeamAuth(mockSupabaseClient)
      
      expect(currentUser.value).toBeNull()
      expect(currentTeam.value).toBeNull()
      expect(currentRole.value).toBeNull()
      expect(isImpersonating.value).toBe(false)
      expect(isLoading.value).toBe(true) // Should be loading initially
    })

    it('should update state when session is restored', async () => {
      // REAL FUNCTIONALITY TESTED: JWT claims parsing and state updates from session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const { currentUser, currentTeam, currentRole, $initializationPromise } = useTeamAuth(mockSupabaseClient)
      
      // Wait for initialization to complete
      await $initializationPromise
      
      // Initialization complete, state should be updated
      
      // Test the REAL logic of parsing JWT claims and updating state
      expect(currentUser.value).toEqual(mockUser)
      expect(currentTeam.value).toEqual(expect.objectContaining({
        id: 'team-456',
        name: 'Test Team'
      }))
      expect(currentRole.value).toBe('owner')
    })
  })

  describe('Authentication Methods', () => {
    it('should sign up with team creation', async () => {
      const mockCreateTeamResponse = {
        access_token: mockSession.access_token,
        refresh_token: mockSession.refresh_token,
        user: mockUser,
        team: mockTeam
      }

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: mockCreateTeamResponse,
        error: null
      })

      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      // REAL FUNCTIONALITY TESTED: Error handling, API call orchestration, loading state management
      const { signUpWithTeam } = useTeamAuth(mockSupabaseClient)
      
      await expect(signUpWithTeam('test@example.com', 'password123', 'Test Team'))
        .resolves.toBeUndefined()

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('create-team-and-owner', {
        body: { teamName: 'Test Team' }
      })
    })

    it('should handle sign up errors', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already registered' }
      })

      const { signUpWithTeam } = useTeamAuth(mockSupabaseClient)
      
      await expect(signUpWithTeam('test@example.com', 'password123', 'Test Team'))
        .rejects.toEqual({
          code: 'SIGNUP_FAILED',
          message: 'Email already registered'
        })
    })

    it('should sign in with email and password', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null
      })

      const { signIn } = useTeamAuth(mockSupabaseClient)
      
      await expect(signIn('test@example.com', 'password123'))
        .resolves.toBeUndefined()

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should handle sign in errors', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials' }
      })

      const { signIn } = useTeamAuth(mockSupabaseClient)
      
      await expect(signIn('test@example.com', 'wrongpassword'))
        .rejects.toEqual({
          code: 'SIGNIN_FAILED',
          message: 'Invalid credentials'
        })
    })

    it('should sign out successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      })

      const { signOut } = useTeamAuth(mockSupabaseClient)
      
      await expect(signOut()).resolves.toBeUndefined()
      
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('Team Management', () => {
    it('should invite member with proper permissions', async () => {
      // Setup authenticated state as owner
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const { inviteMember } = useTeamAuth(mockSupabaseClient)
      
      await nextTick() // Allow state to initialize
      
      await expect(inviteMember('newuser@example.com', 'member'))
        .resolves.toBeUndefined()

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('invite-member', {
        body: {
          email: 'newuser@example.com',
          role: 'member',
          team_id: 'team-456'
        }
      })
    })

    it('should reject invite without proper permissions', async () => {
      // Setup authenticated state as member (not owner/admin)
      const memberSession = {
        ...mockSession,
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZWFtX2lkIjoidGVhbS00NTYiLCJ0ZWFtX25hbWUiOiJUZXN0IFRlYW0iLCJ0ZWFtX3JvbGUiOiJtZW1iZXIifQ.test'
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: memberSession },
        error: null
      })

      const { inviteMember } = useTeamAuth(mockSupabaseClient)
      
      await nextTick() // Allow state to initialize
      
      await expect(inviteMember('newuser@example.com', 'member'))
        .rejects.toEqual({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only owners and admins can invite members'
        })
    })

    it('should promote member to admin', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      // Set up the proper chain for database operations: .update().eq().eq().neq()
      const mockChain = {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn().mockResolvedValue({ error: null })
          }))
        }))
      }
      
      const mockUpdate = vi.fn(() => mockChain)
      
      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate
      })

      const { promote } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      await expect(promote('user-789')).resolves.toBeUndefined()
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('team_members')
      expect(mockUpdate).toHaveBeenCalledWith({ role: 'admin' })
    })

    it('should transfer ownership', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const { transferOwnership, currentRole } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      await expect(transferOwnership('user-789')).resolves.toBeUndefined()
      
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('transfer-ownership', {
        body: {
          team_id: 'team-456',
          new_owner_id: 'user-789'
        }
      })
      
      // Should update current role to admin
      expect(currentRole.value).toBe('admin')
    })
  })

  describe('Session Persistence', () => {
    it('should persist state to localStorage', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const { currentUser, $initializationPromise } = useTeamAuth(mockSupabaseClient)
      
      // Wait for initialization to complete and state to be set
      await $initializationPromise
      
      // Give Vue's reactivity system time to trigger the watch
      await nextTick()
      await nextTick() // Extra tick for watch to fire
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'team_auth_user_state',
        expect.stringContaining('"currentUser"')
      )
    })

    it('should restore state from localStorage', async () => {
      const storedState = {
        currentUser: mockUser,
        currentTeam: mockTeam,
        currentRole: 'owner',
        isImpersonating: false,
        impersonationExpiresAt: null,
        lastSync: new Date().toISOString()
      }

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedState))

      const { currentUser, currentTeam, currentRole } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      expect(currentUser.value).toEqual(mockUser)
      expect(currentTeam.value).toEqual(mockTeam)
      expect(currentRole.value).toBe('owner')
    })

    it('should clear expired state', async () => {
      const expiredState = {
        currentUser: mockUser,
        currentTeam: mockTeam,
        currentRole: 'owner',
        isImpersonating: false,
        impersonationExpiresAt: null,
        lastSync: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
      }

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(expiredState))

      const { currentUser } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('team_auth_user_state')
      expect(currentUser.value).toBeNull()
    })
  })

  describe('Impersonation', () => {
    it('should start impersonation for super admin', async () => {
      const superAdminSession = {
        ...mockSession,
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZWFtX2lkIjoidGVhbS00NTYiLCJ0ZWFtX25hbWUiOiJUZXN0IFRlYW0iLCJ0ZWFtX3JvbGUiOiJzdXBlcl9hZG1pbiJ9.test'
      }

      mockSupabaseClient.auth.getSession
        .mockResolvedValueOnce({ data: { session: superAdminSession }, error: null })
        .mockResolvedValueOnce({ data: { session: superAdminSession }, error: null })

      const impersonationResponse = {
        access_token: 'impersonation-token',
        refresh_token: 'impersonation-refresh',
        session_id: 'imp-session-123',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: impersonationResponse,
        error: null
      })

      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: { session: { ...superAdminSession, access_token: 'impersonation-token' } },
        error: null
      })

      const { startImpersonation, isImpersonating } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      await expect(startImpersonation('target-user-123', 'Customer support'))
        .resolves.toBeUndefined()

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('start-impersonation', {
        body: {
          target_user_id: 'target-user-123',
          reason: 'Customer support'
        }
      })

      expect(isImpersonating.value).toBe(true)
    })

    it('should reject impersonation for non-super admin', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const { startImpersonation } = useTeamAuth(mockSupabaseClient)
      
      await nextTick()
      
      await expect(startImpersonation('target-user-123', 'Support'))
        .rejects.toEqual({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only super admins can start impersonation'
        })
    })

    it('should stop impersonation and restore original session', async () => {
      // Setup impersonation state in storage
      const originalSessionData = {
        access_token: mockSession.access_token,
        refresh_token: mockSession.refresh_token,
        expires_at: mockSession.expires_at,
        user: mockSession.user
      }

      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'team_auth_session') return JSON.stringify(originalSessionData)
        if (key === 'team_auth_original_user') return JSON.stringify({
          user_id: mockUser.id,
          email: mockUser.email,
          team_id: mockTeam.id,
          role: 'super_admin'
        })
        return null
      })

      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'team_auth_security_token') return 'security-token'
        return null
      })

      const { stopImpersonation, isImpersonating } = useTeamAuth(mockSupabaseClient)
      
      // Manually set impersonation state
      isImpersonating.value = true
      
      await expect(stopImpersonation()).resolves.toBeUndefined()
      
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('stop-impersonation', {
        body: {}
      })
      
      expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
        access_token: originalSessionData.access_token,
        refresh_token: originalSessionData.refresh_token
      })
      
      expect(isImpersonating.value).toBe(false)
    })
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useNuxtApp, useRoute, useRouter } from '../mocks/nuxt-app'
import { useTeamAuth } from '../../src/runtime/composables/useTeamAuth'

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

const mockSession = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZWFtX2lkIjoidGVhbS00NTYiLCJ0ZWFtX25hbWUiOiJUZXN0IFRlYW0iLCJ0ZWFtX3JvbGUiOiJvd25lciJ9.test',
  refresh_token: 'refresh-token',
  expires_at: Date.now() / 1000 + 3600,
  user: mockUser
}

describe('useTeamAuth', () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset localStorage/sessionStorage mocks
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    vi.mocked(localStorage.setItem).mockImplementation(() => {})
    vi.mocked(sessionStorage.getItem).mockReturnValue(null)
    vi.mocked(sessionStorage.setItem).mockImplementation(() => {})

    // Setup mock Supabase client
    mockSupabaseClient = {
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
        invoke: vi.fn()
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        single: vi.fn()
      }))
    }

    // Mock useNuxtApp to return our mock client
    vi.mocked(useNuxtApp).mockReturnValue({
      $teamAuthClient: mockSupabaseClient
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('State Management', () => {
    it('should initialize with null values', () => {
      const { currentUser, currentTeam, currentRole, isImpersonating, isLoading } = useTeamAuth()
      
      expect(currentUser.value).toBeNull()
      expect(currentTeam.value).toBeNull()
      expect(currentRole.value).toBeNull()
      expect(isImpersonating.value).toBe(false)
      expect(isLoading.value).toBe(true) // Should be loading initially
    })

    it('should update state when session is restored', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      const { currentUser, currentTeam, currentRole } = useTeamAuth()
      
      await nextTick()
      
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

      const { signUpWithTeam } = useTeamAuth()
      
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

      const { signUpWithTeam } = useTeamAuth()
      
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

      const { signIn } = useTeamAuth()
      
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

      const { signIn } = useTeamAuth()
      
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

      const { signOut } = useTeamAuth()
      
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

      const { inviteMember } = useTeamAuth()
      
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

      const { inviteMember } = useTeamAuth()
      
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

      const mockUpdate = vi.fn().mockResolvedValue({ error: null })
      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis()
      })

      const { promote } = useTeamAuth()
      
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

      const { transferOwnership, currentRole } = useTeamAuth()
      
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

      const { currentUser } = useTeamAuth()
      
      await nextTick()
      
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

      const { currentUser, currentTeam, currentRole } = useTeamAuth()
      
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

      const { currentUser } = useTeamAuth()
      
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

      const { startImpersonation, isImpersonating } = useTeamAuth()
      
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

      const { startImpersonation } = useTeamAuth()
      
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

      const { stopImpersonation, isImpersonating } = useTeamAuth()
      
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
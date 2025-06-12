import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set up global mocks before any imports
Object.assign(globalThis, {
  defineNuxtRouteMiddleware: (fn: any) => fn
})

// Mock Nuxt composables
vi.mock('#app', () => ({
  navigateTo: vi.fn(),
}))

// Mock useTeamAuth composable - declare at module level
vi.mock('../../src/runtime/composables/useTeamAuth', () => ({
  useTeamAuth: vi.fn()
}))

// Import mocked navigateTo and useTeamAuth
import { navigateTo } from '#app'
import { useTeamAuth } from '../../src/runtime/composables/useTeamAuth'

// Import actual middleware after mocking
import authGlobal from '../../src/runtime/middleware/auth.global'
import requireAuth from '../../src/runtime/middleware/require-auth'
import requireTeam from '../../src/runtime/middleware/require-team'
import { createRequireRoleMiddleware } from '../../src/runtime/middleware/require-role'

describe('Middleware Integration Tests', () => {
  let mockNavigateTo: any
  let mockRoute: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigateTo = vi.mocked(navigateTo)
    
    // Default mock route
    mockRoute = {
      path: '/dashboard',
      query: {},
      params: {},
      search: '',
      meta: {}
    }

    // Default auth state - unauthenticated
    vi.mocked(useTeamAuth).mockReturnValue({
      currentUser: { value: null },
      currentTeam: { value: null },
      currentRole: { value: null },
      isLoading: { value: false },
      isImpersonating: { value: false },
      impersonationExpiresAt: { value: null }
    })

    // Mock process.server to be false (client-side)
    vi.stubGlobal('process', { server: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Global Auth Middleware', () => {
    it('should allow access to public routes without authentication', async () => {
      mockRoute.path = '/'
      
      const result = await authGlobal(mockRoute)
      
      expect(result).toBeUndefined() // No redirect
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should allow access to login page without authentication', async () => {
      mockRoute.path = '/login'
      
      const result = await authGlobal(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should redirect unauthenticated users from protected routes', async () => {
      mockRoute.path = '/dashboard'
      
      const result = await authGlobal(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    })

    it('should allow authenticated users to access protected routes', async () => {
      mockRoute.path = '/dashboard'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123', email: 'test@example.com' } },
        currentTeam: { value: { id: 'team-456', name: 'Test Team' } },
        currentRole: { value: 'member' },
        isLoading: { value: false },
        isImpersonating: { value: false }
      })
      
      const result = await authGlobal(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should redirect users without team to team selection', async () => {
      mockRoute.path = '/dashboard'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: null },
        currentRole: { value: null },
        isLoading: { value: false },
        isImpersonating: { value: false }
      })
      
      const result = await authGlobal(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/teams?message=select_team_first')
    })

    it('should block admin routes during impersonation', async () => {
      mockRoute.path = '/admin/users'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'super_admin' },
        isImpersonating: { value: true },
        isLoading: { value: false }
      })
      
      const result = await authGlobal(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/dashboard?error=admin_blocked_during_impersonation')
    })

    it('should validate team-specific routes', async () => {
      mockRoute.path = '/teams/wrong-team-id/dashboard'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false },
        isImpersonating: { value: false }
      })
      
      const result = await authGlobal(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/teams?error=unauthorized_team_access')
    })

    it('should block impersonation routes for non-super admins', async () => {
      mockRoute.path = '/admin/impersonate'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'admin' },
        isLoading: { value: false },
        isImpersonating: { value: false }
      })
      
      const result = await authGlobal(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/dashboard?error=insufficient_permissions')
    })

    it('should handle loading state', async () => {
      mockRoute.path = '/dashboard'
      
      // Start with loading state
      let isLoading = true
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        isLoading: { value: isLoading },
        currentTeam: { value: null },
        currentRole: { value: null },
        isImpersonating: { value: false }
      })

      // Simulate loading completion
      setTimeout(() => {
        isLoading = false
        vi.mocked(useTeamAuth).mockReturnValue({
          currentUser: { value: { id: 'user-123' } },
          currentTeam: { value: { id: 'team-456' } },
          currentRole: { value: 'member' },
          isLoading: { value: false },
          isImpersonating: { value: false }
        })
      }, 50)
      
      const result = await authGlobal(mockRoute)
      
      // Should eventually allow access
      expect(result).toBeUndefined()
    })
  })

  describe('Require Auth Middleware', () => {
    it('should allow authenticated users to proceed', async () => {
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        isLoading: { value: false }
      })
      
      const result = await requireAuth(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should redirect unauthenticated users to login', async () => {
      mockRoute.path = '/dashboard'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireAuth(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    })

    it('should preserve query parameters in redirect', async () => {
      mockRoute.path = '/dashboard'
      mockRoute.query = { tab: 'settings', filter: 'active' }
      mockRoute.search = '?tab=settings&filter=active'
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireAuth(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard%3Ftab%3Dsettings%26filter%3Dactive')
    })
  })

  describe('Require Team Middleware', () => {
    it('should allow users with team membership', async () => {
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false }
      })
      
      const result = await requireTeam(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should redirect unauthenticated users to login', async () => {
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        currentTeam: { value: null },
        currentRole: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireTeam(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    })

    it('should redirect users without team to team selection', async () => {
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: null },
        currentRole: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireTeam(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/teams?message=select_team_first')
    })

    it('should validate team ID from route parameters', async () => {
      mockRoute.params = { teamId: 'wrong-team-id' }
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false }
      })
      
      const result = await requireTeam(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/teams?error=unauthorized_team_access')
    })

    it('should allow access when route team matches user team', async () => {
      mockRoute.params = { teamId: 'team-456' }
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false }
      })
      
      const result = await requireTeam(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  describe('Require Role Middleware', () => {
    it('should allow users with sufficient role level', async () => {
      const requireAdminMiddleware = createRequireRoleMiddleware('admin')
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'admin' },
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await requireAdminMiddleware(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should allow higher roles (owner can access admin routes)', async () => {
      const requireAdminMiddleware = createRequireRoleMiddleware('admin')
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'owner' }, // Higher than admin
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await requireAdminMiddleware(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should deny users with insufficient role level', async () => {
      const requireAdminMiddleware = createRequireRoleMiddleware('admin')
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'member' }, // Lower than admin
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await requireAdminMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/dashboard?error=insufficient_permissions')
    })

    it('should redirect users without role to team selection', async () => {
      const requireAdminMiddleware = createRequireRoleMiddleware('admin')
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: null },
        currentTeam: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireAdminMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/teams?message=select_team_first')
    })

    it('should redirect unauthenticated users to login', async () => {
      const requireAdminMiddleware = createRequireRoleMiddleware('admin')
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        currentRole: { value: null },
        isLoading: { value: false }
      })
      
      const result = await requireAdminMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    })

    it('should enforce strict role matching when configured', async () => {
      const requireExactAdminMiddleware = createRequireRoleMiddleware('admin', { strict: true })
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'owner' }, // Higher than admin
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await requireExactAdminMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/dashboard?error=insufficient_permissions')
    })

    it('should use custom redirect and error message', async () => {
      const customMiddleware = createRequireRoleMiddleware('owner', {
        redirectTo: '/team/settings',
        errorMessage: 'owner_required'
      })
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'admin' },
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await customMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/team/settings?error=owner_required')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid roles gracefully', async () => {
      const invalidRoleMiddleware = createRequireRoleMiddleware('invalid_role' as any)
      
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentRole: { value: 'admin' },
        currentTeam: { value: { id: 'team-456' } },
        isLoading: { value: false }
      })
      
      const result = await invalidRoleMiddleware(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/dashboard?error=invalid_role')
    })

    it('should handle server-side rendering gracefully', async () => {
      vi.stubGlobal('process', { server: true })
      
      const result = await authGlobal(mockRoute)
      
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should handle auth loading timeout', async () => {
      mockRoute.path = '/dashboard'
      
      // Mock loading state that never resolves
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        isLoading: { value: true }, // Always loading
        currentTeam: { value: null },
        currentRole: { value: null },
        isImpersonating: { value: false }
      })
      
      const startTime = Date.now()
      const result = await authGlobal(mockRoute)
      const endTime = Date.now()
      
      // Should timeout after approximately 5 seconds (50 attempts * 100ms)
      expect(endTime - startTime).toBeGreaterThan(4000)
      expect(endTime - startTime).toBeLessThan(6000)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple middleware requirements', async () => {
      // Simulate a route that requires auth + team + admin role
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'admin' },
        isLoading: { value: false },
        isImpersonating: { value: false }
      })
      
      // Run multiple middleware in sequence
      const authResult = await requireAuth(mockRoute)
      const teamResult = await requireTeam(mockRoute)
      const roleMiddleware = createRequireRoleMiddleware('admin')
      const roleResult = await roleMiddleware(mockRoute)
      
      expect(authResult).toBeUndefined()
      expect(teamResult).toBeUndefined()
      expect(roleResult).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should fail fast when first requirement is not met', async () => {
      // User is not authenticated
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: null },
        isLoading: { value: false }
      })
      
      // Should fail at auth check
      const authResult = await requireAuth(mockRoute)
      
      expect(mockNavigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
      expect(mockNavigateTo).toHaveBeenCalledTimes(1)
    })
  })
})
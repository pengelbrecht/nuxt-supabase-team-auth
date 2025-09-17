import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import after mocking
import { useTeamAuth } from '../../src/runtime/composables/useTeamAuth'
import authGlobal from '../../src/runtime/middleware/auth.global'

// Test interfaces
interface MockRoute {
  path: string
  query?: Record<string, string>
  params?: Record<string, string>
  search?: string
}

type MockNavigateTo = (path: string) => void

// Mock useTeamAuth composable
vi.mock('../../src/runtime/composables/useTeamAuth', () => ({
  useTeamAuth: vi.fn(),
}))

// Mock runtime config
const mockRuntimeConfig = {
  public: {
    teamAuth: {
      loginPage: '/signin',
      defaultProtection: 'public',
      protectedRoutes: ['/dashboard'],
      publicRoutes: ['/about'],
    },
  },
}

// Mock #imports for middleware with configurable runtime config
vi.mock('#imports', () => ({
  navigateTo: vi.fn(),
  defineNuxtRouteMiddleware: vi.fn(fn => fn),
  useRuntimeConfig: vi.fn(() => mockRuntimeConfig),
}))

describe('Auth Middleware Configuration Tests', () => {
  let mockRoute: MockRoute
  let mockNavigateTo: MockNavigateTo

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get the mocked navigateTo function
    const { navigateTo: importsNavigateTo } = await vi.importMock('#imports')
    mockNavigateTo = importsNavigateTo

    // Default mock route
    mockRoute = {
      path: '/some-random-route',
      query: {},
      params: {},
      search: '',
    }

    // Default auth state - unauthenticated
    vi.mocked(useTeamAuth).mockReturnValue({
      currentUser: { value: null },
      currentTeam: { value: null },
      currentRole: { value: null },
      isLoading: { value: false },
      isImpersonating: { value: false },
      impersonationExpiresAt: { value: null },
    })

    // Mock process.server to be false (client-side)
    vi.stubGlobal('process', { server: false })

    // Reset runtime config to default
    mockRuntimeConfig.public.teamAuth = {
      loginPage: '/signin',
      defaultProtection: 'public',
      protectedRoutes: ['/dashboard'],
      publicRoutes: ['/about'],
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('defaultProtection: "public" (Bug Fix Verification)', () => {
    beforeEach(() => {
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'public'
      mockRuntimeConfig.public.teamAuth.protectedRoutes = ['/dashboard']
      mockRuntimeConfig.public.teamAuth.publicRoutes = ['/about']
    })

    it('should allow access to routes not in any configuration array (the reported bug)', async () => {
      // This is the exact test case from the bug report
      mockRoute.path = '/privacy'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined() // No redirect
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should allow access to explicitly configured public routes', async () => {
      mockRoute.path = '/about'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should require authentication for explicitly protected routes', async () => {
      mockRoute.path = '/dashboard'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fdashboard')
    })

    it('should allow authenticated users to access protected routes', async () => {
      mockRoute.path = '/dashboard'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false },
        isImpersonating: { value: false },
      })

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should always allow access to auth routes', async () => {
      const authRoutes = ['/login', '/signin', '/signup', '/auth', '/confirm', '/reset-password', '/forgot-password', '/accept-invite']

      for (const route of authRoutes) {
        vi.clearAllMocks()
        mockRoute.path = route

        const result = await authGlobal(mockRoute)

        expect(result).toBeUndefined()
        expect(mockNavigateTo).not.toHaveBeenCalled()
      }
    })

    it('should always allow access to root route', async () => {
      mockRoute.path = '/'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should handle nested routes correctly', async () => {
      // Protected route with nested path
      mockRoute.path = '/dashboard/settings'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fdashboard%2Fsettings')

      // Public route with nested path should be allowed
      vi.clearAllMocks()
      mockRoute.path = '/about/contact'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should handle empty configuration arrays', async () => {
      mockRuntimeConfig.public.teamAuth.protectedRoutes = []
      mockRuntimeConfig.public.teamAuth.publicRoutes = []

      mockRoute.path = '/any-route'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined() // Should be allowed (public by default)
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  describe('defaultProtection: "protected"', () => {
    beforeEach(() => {
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'protected'
      mockRuntimeConfig.public.teamAuth.protectedRoutes = ['/admin'] // This should be ignored in protected mode
      mockRuntimeConfig.public.teamAuth.publicRoutes = ['/about', '/pricing']
    })

    it('should require authentication for routes not in publicRoutes array', async () => {
      mockRoute.path = '/some-random-route'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fsome-random-route')
    })

    it('should allow access to explicitly configured public routes', async () => {
      mockRoute.path = '/about'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should allow access to nested public routes', async () => {
      mockRoute.path = '/about/team'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should always allow access to auth routes even in protected mode', async () => {
      mockRoute.path = '/login'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should always allow access to root route even in protected mode', async () => {
      mockRoute.path = '/'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should allow authenticated users to access any route', async () => {
      mockRoute.path = '/any-protected-route'
      vi.mocked(useTeamAuth).mockReturnValue({
        currentUser: { value: { id: 'user-123' } },
        currentTeam: { value: { id: 'team-456' } },
        currentRole: { value: 'member' },
        isLoading: { value: false },
        isImpersonating: { value: false },
      })

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should handle empty publicRoutes array', async () => {
      mockRuntimeConfig.public.teamAuth.publicRoutes = []

      mockRoute.path = '/any-route'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fany-route')
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should handle missing teamAuth config gracefully', async () => {
      mockRuntimeConfig.public.teamAuth = undefined

      mockRoute.path = '/any-route'

      // Should use defaults: defaultProtection: 'public', protectedRoutes: ['/dashboard']
      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined() // Should default to public
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should handle missing individual config properties', async () => {
      mockRuntimeConfig.public.teamAuth = {
        loginPage: '/signin',
        // Missing defaultProtection, protectedRoutes, publicRoutes
      }

      mockRoute.path = '/random-route'

      const result = await authGlobal(mockRoute)

      expect(result).toBeUndefined() // Should default to public
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })

    it('should preserve query parameters in redirects', async () => {
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'public'
      mockRuntimeConfig.public.teamAuth.protectedRoutes = ['/dashboard']

      mockRoute.path = '/dashboard'
      mockRoute.search = '?tab=settings&filter=active'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fdashboard%3Ftab%3Dsettings%26filter%3Dactive')
    })

    it('should use custom login page from config', async () => {
      mockRuntimeConfig.public.teamAuth.loginPage = '/custom-login'
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'public'
      mockRuntimeConfig.public.teamAuth.protectedRoutes = ['/dashboard']

      mockRoute.path = '/dashboard'

      await authGlobal(mockRoute)

      expect(mockNavigateTo).toHaveBeenCalledWith('/custom-login?redirect=%2Fdashboard')
    })

    it('should handle route prefix matching correctly', async () => {
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'public'
      mockRuntimeConfig.public.teamAuth.protectedRoutes = ['/admin']

      // Should match /admin prefix
      mockRoute.path = '/admin/users'
      await authGlobal(mockRoute)
      expect(mockNavigateTo).toHaveBeenCalledWith('/signin?redirect=%2Fadmin%2Fusers')

      // Should NOT match similar but different routes
      vi.clearAllMocks()
      mockRoute.path = '/administrator'
      const result = await authGlobal(mockRoute)
      expect(result).toBeUndefined()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  describe('Real World Scenarios', () => {
    it('should handle typical blog site configuration (public by default)', async () => {
      mockRuntimeConfig.public.teamAuth = {
        defaultProtection: 'public',
        protectedRoutes: ['/admin', '/dashboard'],
        publicRoutes: ['/blog', '/about', '/contact'],
        loginPage: '/signin',
      }

      const testCases = [
        { path: '/', shouldAllow: true },
        { path: '/blog', shouldAllow: true },
        { path: '/blog/my-post', shouldAllow: true },
        { path: '/about', shouldAllow: true },
        { path: '/contact', shouldAllow: true },
        { path: '/pricing', shouldAllow: true }, // Not in any array, should be public
        { path: '/features', shouldAllow: true }, // Not in any array, should be public
        { path: '/admin', shouldAllow: false },
        { path: '/admin/posts', shouldAllow: false },
        { path: '/dashboard', shouldAllow: false },
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()
        mockRoute.path = testCase.path

        const result = await authGlobal(mockRoute)

        if (testCase.shouldAllow) {
          expect(result).toBeUndefined()
          expect(mockNavigateTo).not.toHaveBeenCalled()
        } else {
          expect(mockNavigateTo).toHaveBeenCalledWith(
            expect.stringContaining('/signin?redirect=')
          )
        }
      }
    })

    it('should handle typical SaaS app configuration (protected by default)', async () => {
      mockRuntimeConfig.public.teamAuth = {
        defaultProtection: 'protected',
        protectedRoutes: [], // Not used in protected mode
        publicRoutes: ['/pricing', '/features', '/about'],
        loginPage: '/signin',
      }

      const testCases = [
        { path: '/', shouldAllow: true }, // Always public
        { path: '/pricing', shouldAllow: true },
        { path: '/features', shouldAllow: true },
        { path: '/about', shouldAllow: true },
        { path: '/dashboard', shouldAllow: false }, // Not in publicRoutes
        { path: '/profile', shouldAllow: false }, // Not in publicRoutes
        { path: '/settings', shouldAllow: false }, // Not in publicRoutes
        { path: '/random-page', shouldAllow: false }, // Not in publicRoutes
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()
        mockRoute.path = testCase.path

        const result = await authGlobal(mockRoute)

        if (testCase.shouldAllow) {
          expect(result).toBeUndefined()
          expect(mockNavigateTo).not.toHaveBeenCalled()
        } else {
          expect(mockNavigateTo).toHaveBeenCalledWith(
            expect.stringContaining('/signin?redirect=')
          )
        }
      }
    })
  })
})
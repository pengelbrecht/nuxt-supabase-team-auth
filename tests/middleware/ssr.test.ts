import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useTeamAuth } from '../../src/runtime/composables/useTeamAuth'
import { useSupabaseUser } from '../../src/runtime/composables/useSupabaseComposables'
import { isServerRender } from '../../src/runtime/utils/ssr'
import authGlobal from '../../src/runtime/middleware/auth.global'
import requireAuth from '../../src/runtime/middleware/require-auth'
import requireTeam from '../../src/runtime/middleware/require-team'
import { createRequireRoleMiddleware } from '../../src/runtime/middleware/require-role'
import redirectAuthenticated, { createRedirectAuthenticated } from '../../src/runtime/middleware/redirect-authenticated'
import impersonation, {
  requireSuperAdminForImpersonation,
  blockDuringImpersonation,
  createImpersonationRestriction,
} from '../../src/runtime/middleware/impersonation'

/**
 * Server-side rendering behaviour of the route middleware.
 *
 * On the server the team-auth state is never initialised (initializeAuth()
 * runs in the browser only), so `isLoading` stays true for the whole request.
 * The middleware must not wait for it there: every SSR request used to sleep
 * for the full 2 s (5 s for impersonation) timeout. Server decisions come from
 * the cookie-based Supabase user instead; everything else is left to the
 * client, which runs the middleware again on hydration.
 */

vi.mock('../../src/runtime/composables/useTeamAuth', () => ({
  useTeamAuth: vi.fn(),
}))

vi.mock('../../src/runtime/composables/useSupabaseComposables', () => ({
  useSupabaseUser: vi.fn(),
}))

vi.mock('../../src/runtime/utils/ssr', () => ({
  isServerRender: vi.fn(() => false),
}))

const mockRuntimeConfig = {
  public: {
    teamAuth: {
      loginPage: '/login',
      defaultProtection: 'public',
      protectedRoutes: ['/dashboard'],
      publicRoutes: [] as string[],
    },
  },
}

vi.mock('#imports', () => ({
  navigateTo: vi.fn((path: string) => ({ redirectedTo: path })),
  defineNuxtRouteMiddleware: vi.fn(fn => fn),
  useRuntimeConfig: vi.fn(() => mockRuntimeConfig),
}))

type Middleware = (to: any) => Promise<unknown> | unknown

const route = (fullPath: string) => {
  const path = fullPath.split('?')[0]
  return { path, fullPath, query: {}, params: {}, meta: {} }
}

const signedIn = { id: 'user-123', email: 'owner@example.com' }

/**
 * Team-auth state as it is on the server: never initialised, so still loading
 * and without a user, team or role.
 */
const serverTeamAuthState = () => ({
  currentUser: { value: null },
  currentTeam: { value: null },
  currentRole: { value: null },
  isLoading: { value: true },
  isImpersonating: { value: false },
  impersonationExpiresAt: { value: null },
})

async function timed(middleware: Middleware, to: ReturnType<typeof route>) {
  const start = performance.now()
  const result = await middleware(to)
  return { result, ms: performance.now() - start }
}

describe('Route middleware during SSR', () => {
  let navigateTo: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const imports = await vi.importMock<{ navigateTo: ReturnType<typeof vi.fn> }>('#imports')
    navigateTo = imports.navigateTo

    mockRuntimeConfig.public.teamAuth = {
      loginPage: '/login',
      defaultProtection: 'public',
      protectedRoutes: ['/dashboard'],
      publicRoutes: [],
    }

    vi.mocked(isServerRender).mockReturnValue(true)
    vi.mocked(useTeamAuth).mockReturnValue(serverTeamAuthState() as any)
    vi.mocked(useSupabaseUser).mockReturnValue({ value: null } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auth.global', () => {
    it('does not wait for isLoading on public routes', async () => {
      for (const path of ['/', '/login', '/about']) {
        const { result, ms } = await timed(authGlobal, route(path))
        expect(result).toBeUndefined()
        expect(ms).toBeLessThan(50)
      }
      expect(navigateTo).not.toHaveBeenCalled()
    })

    it('redirects a signed-out user on a protected route to login without waiting', async () => {
      const { result, ms } = await timed(authGlobal, route('/dashboard/recipes?tab=all'))

      expect(ms).toBeLessThan(50)
      expect(navigateTo).toHaveBeenCalledTimes(1)
      expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard%2Frecipes%3Ftab%3Dall')
      expect(result).toEqual({ redirectedTo: '/login?redirect=%2Fdashboard%2Frecipes%3Ftab%3Dall' })
    })

    it('lets a signed-in user through on a protected route without waiting', async () => {
      vi.mocked(useSupabaseUser).mockReturnValue({ value: signedIn } as any)

      const { result, ms } = await timed(authGlobal, route('/dashboard'))

      expect(ms).toBeLessThan(50)
      expect(result).toBeUndefined()
      // No team-integrity redirect either: team state only exists on the client
      expect(navigateTo).not.toHaveBeenCalled()
    })

    it('redirects a signed-out user in protected-by-default mode', async () => {
      mockRuntimeConfig.public.teamAuth.defaultProtection = 'protected'
      mockRuntimeConfig.public.teamAuth.publicRoutes = ['/about']

      const { ms } = await timed(authGlobal, route('/settings'))
      expect(ms).toBeLessThan(50)
      expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fsettings')

      navigateTo.mockClear()
      const publicRoute = await timed(authGlobal, route('/about'))
      expect(publicRoute.result).toBeUndefined()
      expect(navigateTo).not.toHaveBeenCalled()
    })

    it('does not touch the team-auth loading state', async () => {
      const state = serverTeamAuthState()
      vi.mocked(useTeamAuth).mockReturnValue(state as any)
      vi.mocked(useSupabaseUser).mockReturnValue({ value: signedIn } as any)

      await authGlobal(route('/dashboard'))

      // The client relies on `loading: true` in the payload to wait for
      // initializeAuth() before guarding protected routes on hydration.
      expect(state.isLoading.value).toBe(true)
    })
  })

  describe.each([
    ['require-auth', requireAuth as Middleware],
    ['require-team', requireTeam as Middleware],
    ['require-role', createRequireRoleMiddleware('admin') as Middleware],
  ])('%s', (_name, middleware) => {
    it('redirects a signed-out user to login without waiting', async () => {
      const { result, ms } = await timed(middleware, route('/dashboard/team'))

      expect(ms).toBeLessThan(50)
      expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard%2Fteam')
      expect(result).toEqual({ redirectedTo: '/login?redirect=%2Fdashboard%2Fteam' })
    })

    it('does not redirect a signed-in user (team/role checks are left to the client)', async () => {
      vi.mocked(useSupabaseUser).mockReturnValue({ value: signedIn } as any)

      const { result, ms } = await timed(middleware, route('/dashboard/team'))

      expect(ms).toBeLessThan(50)
      expect(result).toBeUndefined()
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })

  describe.each([
    ['redirect-authenticated', redirectAuthenticated as Middleware],
    ['createRedirectAuthenticated', createRedirectAuthenticated('/dashboard') as Middleware],
    ['impersonation', impersonation as Middleware],
    ['blockDuringImpersonation', blockDuringImpersonation as Middleware],
    ['createImpersonationRestriction', createImpersonationRestriction({ checkSuperAdmin: true }) as Middleware],
  ])('%s', (_name, middleware) => {
    it('returns immediately and leaves the decision to the client', async () => {
      vi.mocked(useSupabaseUser).mockReturnValue({ value: signedIn } as any)

      const { result, ms } = await timed(middleware, route('/login?redirect=%2Fdashboard'))

      expect(ms).toBeLessThan(50)
      expect(result).toBeUndefined()
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })

  describe('requireSuperAdminForImpersonation', () => {
    it('redirects a signed-out user to login without waiting', async () => {
      const { ms } = await timed(requireSuperAdminForImpersonation as Middleware, route('/admin/impersonate'))

      expect(ms).toBeLessThan(50)
      expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fadmin%2Fimpersonate')
    })

    it('does not redirect a signed-in user (role check is left to the client)', async () => {
      vi.mocked(useSupabaseUser).mockReturnValue({ value: signedIn } as any)

      const { result, ms } = await timed(requireSuperAdminForImpersonation as Middleware, route('/admin/impersonate'))

      expect(ms).toBeLessThan(50)
      expect(result).toBeUndefined()
      expect(navigateTo).not.toHaveBeenCalled()
    })
  })
})

describe('Route middleware on the client', () => {
  let navigateTo: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const imports = await vi.importMock<{ navigateTo: ReturnType<typeof vi.fn> }>('#imports')
    navigateTo = imports.navigateTo

    mockRuntimeConfig.public.teamAuth = {
      loginPage: '/login',
      defaultProtection: 'public',
      protectedRoutes: ['/dashboard'],
      publicRoutes: [],
    }

    vi.mocked(isServerRender).mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auth.global still waits for isLoading before guarding a protected route', async () => {
    const state = serverTeamAuthState()
    vi.mocked(useTeamAuth).mockReturnValue(state as any)

    let settled = false
    const pending = Promise.resolve(authGlobal(route('/dashboard'))).then((r) => {
      settled = true
      return r
    })

    // Hydration: session restore still in progress
    await vi.advanceTimersByTimeAsync(500)
    expect(settled).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()

    // initializeAuth() resolves with a signed-in user and team
    state.currentUser.value = signedIn as any
    state.currentTeam.value = { id: 'team-1' } as any
    state.isLoading.value = false
    await vi.advanceTimersByTimeAsync(100)

    expect(settled).toBe(true)
    expect(await pending).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
    // The client never consults the server-side Supabase user state
    expect(useSupabaseUser).not.toHaveBeenCalled()
  })

  it('auth.global redirects on the client once loading resolves without a session', async () => {
    const state = serverTeamAuthState()
    vi.mocked(useTeamAuth).mockReturnValue(state as any)

    const pending = authGlobal(route('/dashboard'))
    await vi.advanceTimersByTimeAsync(300)
    expect(navigateTo).not.toHaveBeenCalled()

    state.isLoading.value = false
    await vi.advanceTimersByTimeAsync(100)
    await pending

    expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
  })

  it('auth.global gives up after the 2 s timeout on the client and proceeds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(useTeamAuth).mockReturnValue(serverTeamAuthState() as any)

    const pending = authGlobal(route('/dashboard'))
    await vi.advanceTimersByTimeAsync(2000)
    await pending

    expect(warn).toHaveBeenCalledWith('[Team Auth] Auth loading timeout in middleware, proceeding anyway')
    expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
    warn.mockRestore()
  })

  it('auth.global no longer waits on public routes on the client', async () => {
    vi.mocked(useTeamAuth).mockReturnValue(serverTeamAuthState() as any)

    // Resolves without advancing timers
    await expect(authGlobal(route('/'))).resolves.toBeUndefined()
    await expect(authGlobal(route('/about'))).resolves.toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  // Hard navigation: the client state starts as loading with `currentUser`
  // null. The named middleware must wait for the session restore instead of
  // treating `null` as "signed out" on the first tick (same as gh#52). This
  // matters more now that auth.global no longer waits on public routes.
  const hydratingState = () => serverTeamAuthState()
  const finishLoading = (state: ReturnType<typeof serverTeamAuthState>) => {
    state.currentUser.value = signedIn as any
    state.currentTeam.value = { id: 'team-1' } as any
    state.currentRole.value = 'owner' as any
    state.isLoading.value = false
  }

  it('redirect-authenticated waits for the session restore on a hard nav, then redirects', async () => {
    const state = hydratingState()
    vi.mocked(useTeamAuth).mockReturnValue(state as any)

    const to = { ...route('/login?redirect=%2Fdashboard%2Frecipes'), query: { redirect: '/dashboard/recipes' } }
    const pending = redirectAuthenticated(to)
    await vi.advanceTimersByTimeAsync(300)
    expect(navigateTo).not.toHaveBeenCalled()

    finishLoading(state)
    await vi.advanceTimersByTimeAsync(100)
    await pending

    expect(navigateTo).toHaveBeenCalledWith('/dashboard/recipes')
  })

  it.each([
    ['require-auth', requireAuth as Middleware],
    ['require-team', requireTeam as Middleware],
    ['require-role', createRequireRoleMiddleware('admin') as Middleware],
  ])('%s waits for the session restore on a hard nav and lets a signed-in user through', async (_name, middleware) => {
    const state = hydratingState()
    vi.mocked(useTeamAuth).mockReturnValue(state as any)

    const pending = middleware(route('/dashboard/team'))
    await vi.advanceTimersByTimeAsync(300)
    expect(navigateTo).not.toHaveBeenCalled()

    finishLoading(state)
    await vi.advanceTimersByTimeAsync(100)

    expect(await pending).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('redirect-authenticated still redirects a signed-in user on the client', async () => {
    vi.mocked(useTeamAuth).mockReturnValue({
      ...serverTeamAuthState(),
      currentUser: { value: signedIn },
      currentTeam: { value: { id: 'team-1' } },
      isLoading: { value: false },
    } as any)

    await redirectAuthenticated(route('/login'))

    expect(navigateTo).toHaveBeenCalledWith('/dashboard')
  })
})

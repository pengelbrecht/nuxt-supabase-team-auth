import { vi } from 'vitest'

/**
 * Mock Nuxt context for middleware testing
 */
export function createMockNuxtContext(overrides: any = {}) {
  const defaultContext = {
    route: {
      path: '/',
      name: 'index',
      params: {},
      query: {},
      hash: '',
      meta: {},
    },
    router: {
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    },
    app: {
      $teamAuthClient: {
        auth: {
          getSession: vi.fn(),
          onAuthStateChange: vi.fn(),
          signOut: vi.fn(),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(),
        })),
      },
    },
    auth: {
      currentUser: { value: null },
      currentTeam: { value: null },
      currentRole: { value: null },
      isLoading: { value: false },
      isImpersonating: { value: false },
      impersonationExpiresAt: { value: null },
    },
    ssrContext: null,
    payload: {},
    isHydrating: false,
    ...overrides,
  }

  return defaultContext
}

/**
 * Mock navigateTo function for testing redirects
 */
export const mockNavigateTo = vi.fn()

/**
 * Mock route composable
 */
export function createMockRoute(routeData: any = {}) {
  return {
    path: '/',
    name: 'index',
    params: {},
    query: {},
    hash: '',
    meta: {},
    ...routeData,
  }
}

/**
 * Mock router composable
 */
export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: {
      value: createMockRoute(),
    },
  }
}

/**
 * Mock Nuxt app composable
 */
export function createMockNuxtApp(overrides: any = {}) {
  return {
    $teamAuthClient: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
        signOut: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      })),
      functions: {
        invoke: vi.fn(),
      },
    },
    ...overrides,
  }
}

/**
 * Mock useTeamAuth composable for middleware tests
 */
export function createMockTeamAuth(overrides: any = {}) {
  return {
    currentUser: { value: null },
    currentTeam: { value: null },
    currentRole: { value: null },
    isLoading: { value: false },
    isImpersonating: { value: false },
    impersonationExpiresAt: { value: null },
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUpWithTeam: vi.fn(),
    inviteMember: vi.fn(),
    promote: vi.fn(),
    transferOwnership: vi.fn(),
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    ...overrides,
  }
}

/**
 * Setup global mocks for middleware testing
 */
export function setupMiddlewareMocks() {
  vi.mock('#app', () => ({
    navigateTo: mockNavigateTo,
    useRoute: () => createMockRoute(),
    useRouter: () => createMockRouter(),
    useNuxtApp: () => createMockNuxtApp(),
  }))

  vi.mock('../../src/runtime/composables/useTeamAuth', () => ({
    useTeamAuth: () => createMockTeamAuth(),
  }))

  return {
    navigateTo: mockNavigateTo,
    route: createMockRoute(),
    router: createMockRouter(),
    nuxtApp: createMockNuxtApp(),
    teamAuth: createMockTeamAuth(),
  }
}

/**
 * Reset all mocks
 */
export function resetMiddlewareMocks() {
  vi.clearAllMocks()
  mockNavigateTo.mockClear()
}

/**
 * Assert redirect was called with expected URL
 */
export function expectRedirect(url: string, options?: any) {
  expect(mockNavigateTo).toHaveBeenCalledWith(url, options)
}

/**
 * Assert no redirect was called
 */
export function expectNoRedirect() {
  expect(mockNavigateTo).not.toHaveBeenCalled()
}

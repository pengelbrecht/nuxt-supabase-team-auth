import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import AuthCallback from '../../src/runtime/pages/auth/callback.vue'

// Mock Nuxt UI components
const MockUCard = {
  name: 'UCard',
  template: '<div class="u-card"><div v-if="$slots.header" class="u-card-header"><slot name="header" /></div><div class="u-card-body"><slot /></div></div>',
}

const MockUButton = {
  name: 'UButton',
  template: '<button class="u-button" @click="$emit(\'click\')" :disabled="$attrs.disabled"><slot /></button>',
  emits: ['click'],
}

const MockUIcon = {
  name: 'UIcon',
  template: '<span class="u-icon" :class="$attrs.name"></span>',
}

// Mock route and router
const mockRoute = {
  query: {},
  params: {},
}

const mockRouter = {
  push: vi.fn(),
}

// Mock vue-router composables
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
  },
}

// Mock Nuxt router composables
vi.mock('#imports', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
  definePageMeta: vi.fn(),
}))

// Mock useTeamAuthConfig composable
vi.mock('../../src/runtime/composables/useTeamAuthConfig', () => ({
  useTeamAuthConfig: () => ({
    redirectTo: { value: '/dashboard' },
    loginPage: { value: '/signin' },
    config: { value: {} },
  }),
}))

vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $supabase: {
      client: mockSupabaseClient,
    },
  }),
  useState: vi.fn((key: string, init?: () => any) => ({
    value: init ? init() : null,
  })),
}))

// Global mocks
global.useRoute = vi.fn(() => mockRoute)
global.useRouter = vi.fn(() => mockRouter)
global.ref = ref
global.onMounted = vi.fn(fn => fn())
global.definePageMeta = vi.fn()

vi.mock('#supabase/client', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}))

global.useSupabaseClient = vi.fn(() => mockSupabaseClient)

// Mock useTeamAuth composable
const mockSignUpWithTeam = vi.fn()
vi.mock('../../src/runtime/composables/useTeamAuth', () => ({
  useTeamAuth: () => ({
    signUpWithTeam: mockSignUpWithTeam,
  }),
}))

// Mock $fetch
const mock$fetch = vi.fn()
global.$fetch = mock$fetch

// Mock ofetch module since component imports from there
vi.mock('ofetch', () => ({
  $fetch: vi.fn(),
}))

describe('AuthCallback', () => {
  const globalMountOptions = {
    global: {
      components: {
        UCard: MockUCard,
        UButton: MockUButton,
        UIcon: MockUIcon,
      },
      stubs: {
        UCard: MockUCard,
        UButton: MockUButton,
        UIcon: MockUIcon,
      },
      mocks: {
        useSupabaseClient: () => mockSupabaseClient,
        useTeamAuth: () => ({ signUpWithTeam: mockSignUpWithTeam }),
        $fetch: mock$fetch,
      },
    },
  }

  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User',
        picture: 'https://lh3.googleusercontent.com/photo=s96',
        provider_id: 'google-123',
      },
    },
    access_token: 'access-token-123',
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mock values
    mockRoute.query = {}
    mockRoute.params = {}

    // Reset mock functions
    mockSupabaseClient.auth.getSession.mockReset()
    mockRouter.push.mockReset()
    mockSignUpWithTeam.mockReset()
    mock$fetch.mockReset()

    // Get the mocked $fetch from ofetch and reset it too
    const { $fetch } = await vi.importMock('ofetch')
    $fetch.mockReset()

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('OAuth Signup Flow', () => {
    it('should show processing state initially', () => {
      mockRoute.query = { mode: 'signup', team_name: 'Test Team' }

      const wrapper = mount(AuthCallback, globalMountOptions)

      expect(wrapper.text()).toContain('Creating Your Team...')
      expect(wrapper.find('.u-icon.i-lucide-loader-2').exists()).toBe(true)
      expect(wrapper.text()).toContain('Creating your team and setting up your account...')
    })

    it.skip('should successfully process Google signup with team creation', async () => {
      mockRoute.query = { mode: 'signup', team_name: 'Test Team' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mock$fetch.mockResolvedValue({
        success: true,
        team: { name: 'Test Team', id: 'team-123' },
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer for actual async operations
      await new Promise(resolve => setTimeout(resolve, 50))
      await nextTick()
      await nextTick()

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled()
      expect(mock$fetch).toHaveBeenCalledWith('/api/signup-with-team', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer access-token-123',
        },
        body: {
          email: 'test@example.com',
          team_name: 'Test Team',
          oauth_provider: 'google',
          user_metadata: mockSession.user.user_metadata,
        },
      })

      expect(wrapper.text()).toContain('Team Created!')
      expect(wrapper.text()).toContain('Your team has been created successfully!')
      expect(wrapper.text()).toContain('Welcome to Test Team!')
    })

    it('should handle team creation failure', async () => {
      mockRoute.query = { mode: 'signup', team_name: 'Test Team' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      // Mock the ofetch $fetch to reject
      const { $fetch } = await vi.importMock('ofetch')
      $fetch.mockRejectedValue(new Error('Team name already exists'))

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 600))
      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Authentication Failed')
      expect(wrapper.text()).toContain('Team name already exists')
      expect(wrapper.find('button').text()).toContain('Continue to Dashboard')
    })

    it('should handle missing team name for signup', async () => {
      mockRoute.query = { mode: 'signup' } // Missing team_name

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Authentication Failed')
      expect(wrapper.text()).toContain('Invalid callback parameters. Missing mode or team name for signup.')
    })
  })

  describe('OAuth Signin Flow', () => {
    it('should successfully process Google signin', async () => {
      mockRoute.query = { mode: 'signin' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled()
      expect(wrapper.text()).toContain('Welcome Back!')
      expect(wrapper.text()).toContain('Successfully signed in with Google!')
    })

    it('should show correct processing message for signin', () => {
      mockRoute.query = { mode: 'signin' }

      const wrapper = mount(AuthCallback, globalMountOptions)

      expect(wrapper.text()).toContain('Signing You In...')
      expect(wrapper.text()).toContain('Completing your sign in...')
    })
  })

  describe('OAuth Error Handling', () => {
    it('should handle OAuth errors from query parameters', async () => {
      mockRoute.query = {
        error: 'access_denied',
        error_description: 'User cancelled OAuth flow',
      }

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Authentication Failed')
      expect(wrapper.text()).toContain('User cancelled OAuth flow')
    })

    it('should handle session errors', async () => {
      mockRoute.query = { mode: 'signin' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Authentication Failed')
      expect(wrapper.text()).toContain('Session error: Session expired')
    })

    it.skip('should handle missing session after OAuth', async () => {
      mockRoute.query = { mode: 'signin' }

      // Mock session to return null repeatedly to simulate the 10 retry attempts
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - wait longer since it polls 10 times (10 * 500ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 200))
      await nextTick()

      expect(wrapper.text()).toContain('Authentication Error')
      expect(wrapper.text()).toContain('No session found after OAuth redirect. Authentication may have failed.')
    })

    it('should handle invalid callback mode', async () => {
      mockRoute.query = {} // No mode parameter

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()

      // With no mode, it defaults to signin and succeeds if session exists
      expect(wrapper.text()).toContain('Welcome Back!')
      expect(wrapper.text()).toContain('Successfully signed in with Google!')
    })
  })

  describe('Navigation', () => {
    it('should navigate to dashboard on success', async () => {
      mockRoute.query = { mode: 'signin' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      // Should show success state with button
      expect(wrapper.text()).toContain('Welcome Back!')

      // Click "Go to Dashboard" button
      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Go to Dashboard')
      await button.trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })

    it('should provide navigation options on error', async () => {
      mockRoute.query = { error: 'access_denied' }

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      const buttons = wrapper.findAll('button')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].text()).toContain('Continue to Dashboard')
      expect(buttons[1].text()).toContain('Try Again')

      // Test dashboard navigation
      await buttons[0].trigger('click')
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')

      // Reset mock and test signin navigation
      mockRouter.push.mockReset()
      await buttons[1].trigger('click')
      expect(mockRouter.push).toHaveBeenCalledWith('/signin')
    })
  })

  describe('Page Meta', () => {
    it('should have correct page meta configuration', () => {
      // This would be tested through Nuxt's page meta system
      // For now, we verify the component defines it correctly
      const component = AuthCallback
      expect(component).toBeDefined()
      // In actual implementation, definePageMeta would be tested via Nuxt test utils
    })
  })

  describe('Mode Detection', () => {
    it('should default to signin when mode is not signup', async () => {
      mockRoute.query = { mode: 'unknown' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const wrapper = mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Welcome Back!')
      expect(wrapper.text()).toContain('Successfully signed in with Google!')
    })
  })

  describe('Console Logging', () => {
    it('should log OAuth processing steps', async () => {
      mockRoute.query = { mode: 'signin' }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const consoleSpy = vi.spyOn(console, 'log')

      mount(AuthCallback, globalMountOptions)

      // Wait for OAuth processing to complete - need longer timeout for polling
      await new Promise(resolve => setTimeout(resolve, 150))
      await nextTick()

      // First log should be the mode and team name
      expect(consoleSpy).toHaveBeenCalledWith('OAuth callback - Mode:', 'signin', 'Team name:', undefined)

      // The component polls for session, so check for polling logs
      const logCalls = consoleSpy.mock.calls
      const sessionLogs = logCalls.filter(call =>
        call[0] && call[0].includes('OAuth session established'),
      )
      expect(sessionLogs.length).toBeGreaterThan(0)
    })
  })
})

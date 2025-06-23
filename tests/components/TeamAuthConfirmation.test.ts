import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TeamAuthConfirmation from '../../src/runtime/components/TeamAuthConfirmation.vue'

// Mock Nuxt UI components
const MockUCard = {
  name: 'UCard',
  template: '<div class="u-card"><div v-if="$slots.header" class="u-card-header"><slot name="header" /></div><div class="u-card-body"><slot /></div></div>',
}

const MockUButton = {
  name: 'UButton',
  template: '<button class="u-button" @click="$emit(\'click\')"><slot /></button>',
  emits: ['click'],
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

// Mock Nuxt app
const mockNuxtApp = {
  $teamAuthClient: {
    auth: {
      verifyOtp: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}

// Mock multiple Nuxt import paths
vi.mock('#app', () => ({
  useNuxtApp: () => mockNuxtApp,
}))

vi.mock('nuxt/app', () => ({
  useNuxtApp: () => mockNuxtApp,
}))

vi.mock('@nuxt/app', () => ({
  useNuxtApp: () => mockNuxtApp,
}))

// Global mock for useNuxtApp
global.useNuxtApp = vi.fn(() => mockNuxtApp)

describe('TeamAuthConfirmation', () => {
  const globalMountOptions = {
    global: {
      components: {
        UCard: MockUCard,
        UButton: MockUButton,
      },
      stubs: {
        UCard: MockUCard,
        UButton: MockUButton,
      },
      provide: {
        $teamAuthClient: mockNuxtApp.$teamAuthClient,
      },
      mocks: {
        useNuxtApp: () => mockNuxtApp,
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock values
    mockRoute.query = {}
    mockRoute.params = {}

    // Reset mock functions
    mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockReset()
    mockNuxtApp.$teamAuthClient.functions.invoke.mockReset()
    mockRouter.push.mockReset()

    // Mock window.location.hash
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      writable: true,
    })
  })

  describe('Email Confirmation Flow', () => {
    it('should show loading state initially', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Should show loading state immediately
      expect(_wrapper.text()).toContain('Processing confirmation')
    })

    it('should successfully confirm email', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(mockNuxtApp.$teamAuthClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'test-token',
        type: 'email',
      })

      expect(_wrapper.text()).toContain('Email Confirmed!')
      expect(_wrapper.text()).toContain('Your email has been confirmed')
    })

    it('should handle email confirmation error', async () => {
      mockRoute.query = { token: 'invalid-token', type: 'email' }

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: { message: 'Invalid token' },
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Since confirmationType is set to 'email' inside handleEmailConfirmation before the error
      expect(_wrapper.text()).toContain('Email Confirmation Failed')
      expect(_wrapper.text()).toContain('Invalid token')
      expect(_wrapper.find('button').text()).toContain('Try Again')
    })
  })

  describe('Invitation Acceptance Flow', () => {
    it('should successfully accept invitation', async () => {
      mockRoute.query = {
        team_id: 'team-123',
        email: 'user@example.com',
        type: 'invite',
      }

      mockNuxtApp.$teamAuthClient.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(mockNuxtApp.$teamAuthClient.functions.invoke).toHaveBeenCalledWith('accept-invite', {
        body: {
          team_id: 'team-123',
          email: 'user@example.com',
        },
      })

      expect(_wrapper.text()).toContain('Invitation Accepted!')
      expect(_wrapper.text()).toContain('You have successfully joined the team')
    })

    it('should handle invitation acceptance error', async () => {
      mockRoute.query = {
        team_id: 'team-123',
        email: 'user@example.com',
        type: 'invite',
      }

      mockNuxtApp.$teamAuthClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Invitation expired' },
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Since confirmationType is set to 'invite' inside handleInviteAcceptance before the error
      expect(_wrapper.text()).toContain('Invitation Acceptance Failed')
      expect(_wrapper.text()).toContain('Invitation expired')
    })

    it('should handle missing team_id for invitation', async () => {
      mockRoute.query = {
        email: 'user@example.com',
        type: 'invite',
      }

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Since confirmationType is set to 'invite' inside handleInviteAcceptance before the error
      expect(_wrapper.text()).toContain('Invitation Acceptance Failed')
      expect(_wrapper.text()).toContain('Missing team information')
    })
  })

  describe('Hash Parameter Fallback', () => {
    it('should extract parameters from hash when query params are missing', async () => {
      mockRoute.query = {}
      window.location.hash = '#token=hash-token&type=email'

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(mockNuxtApp.$teamAuthClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'hash-token',
        type: 'email',
      })
    })

    it('should prioritize query params over hash params', async () => {
      mockRoute.query = { token: 'query-token', type: 'email' }
      window.location.hash = '#token=hash-token&type=signup'

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(mockNuxtApp.$teamAuthClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'query-token',
        type: 'email',
      })
    })
  })

  describe('Invalid/Missing Parameters', () => {
    it('should show invalid link message for missing parameters', async () => {
      mockRoute.query = {}
      window.location.hash = ''

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(_wrapper.text()).toContain('Confirmation Failed')
      expect(_wrapper.text()).toContain('Unable to determine confirmation type')
    })

    it('should show invalid link for unrecognized type', async () => {
      mockRoute.query = { token: 'test-token', type: 'unknown' }

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      expect(_wrapper.text()).toContain('Confirmation Failed')
      expect(_wrapper.text()).toContain('Unable to determine confirmation type')
    })
  })

  describe('Retry Functionality', () => {
    it('should retry confirmation on button click', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockNuxtApp.$teamAuthClient.auth.verifyOtp
        .mockResolvedValueOnce({ error: { message: 'Network error' } })
        .mockResolvedValueOnce({ error: null })

      const _wrapper = mount(TeamAuthConfirmation, globalMountOptions)

      // Wait for initial processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Should show error first
      expect(_wrapper.text()).toContain('Network error')

      // Click retry button
      await _wrapper.find('button').trigger('click')

      // Wait for retry to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Should show success after retry
      expect(_wrapper.text()).toContain('Email Confirmed!')
    })
  })

  describe('Redirect Functionality', () => {
    it('should redirect after successful confirmation', async () => {
      mockRoute.query = {
        token: 'test-token',
        type: 'email',
        redirect_to: '/dashboard',
      }

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, {
        ...globalMountOptions,
        props: { redirectUrl: '/default' },
      })

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Click continue button
      await _wrapper.find('button').trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })

    it('should use default redirect URL when none provided', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockNuxtApp.$teamAuthClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const _wrapper = mount(TeamAuthConfirmation, {
        ...globalMountOptions,
        props: { redirectUrl: '/default-page' },
      })

      // Wait for processConfirmation to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()
      await nextTick()

      // Click continue button
      await _wrapper.find('button').trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/default-page')
    })
  })

  describe('Debug Mode', () => {
    it('should log parameters in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockRoute.query = { token: 'test-token', type: 'email' }

      const _wrapper = mount(TeamAuthConfirmation, {
        ...globalMountOptions,
        props: { debug: true },
      })

      // Wait for processConfirmation to start and log
      await new Promise(resolve => setTimeout(resolve, 0))
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledWith('Confirmation parameters:', expect.any(Object))

      consoleSpy.mockRestore()
    })
  })
})

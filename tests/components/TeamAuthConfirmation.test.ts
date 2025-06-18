import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TeamAuthConfirmation from '../../src/runtime/components/TeamAuthConfirmation.vue'

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

vi.mock('#app', () => ({
  useNuxtApp: () => mockNuxtApp,
}))

describe('TeamAuthConfirmation', () => {
  let mockSupabaseClient: any

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

      const wrapper = mount(TeamAuthConfirmation)

      expect(wrapper.text()).toContain('Processing confirmation')
      expect(wrapper.find('.loading-spinner')).toBeTruthy()
    })

    it('should successfully confirm email', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick() // Wait for async confirmation

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'test-token',
        type: 'email',
      })

      expect(wrapper.text()).toContain('Email Confirmed!')
      expect(wrapper.text()).toContain('Your email has been confirmed')
    })

    it('should handle email confirmation error', async () => {
      mockRoute.query = { token: 'invalid-token', type: 'email' }

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: { message: 'Invalid token' },
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Email Confirmation Failed')
      expect(wrapper.text()).toContain('Invalid token')
      expect(wrapper.find('button').text()).toContain('Try Again')
    })
  })

  describe('Invitation Acceptance Flow', () => {
    it('should successfully accept invitation', async () => {
      mockRoute.query = {
        team_id: 'team-123',
        email: 'user@example.com',
        type: 'invite',
      }

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('accept-invite', {
        body: {
          team_id: 'team-123',
          email: 'user@example.com',
        },
      })

      expect(wrapper.text()).toContain('Invitation Accepted!')
      expect(wrapper.text()).toContain('You have successfully joined the team')
    })

    it('should handle invitation acceptance error', async () => {
      mockRoute.query = {
        team_id: 'team-123',
        email: 'user@example.com',
        type: 'invite',
      }

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Invitation expired' },
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Invitation Acceptance Failed')
      expect(wrapper.text()).toContain('Invitation expired')
    })

    it('should handle missing team_id for invitation', async () => {
      mockRoute.query = {
        email: 'user@example.com',
        type: 'invite',
      }

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Invitation Acceptance Failed')
      expect(wrapper.text()).toContain('Missing team information')
    })
  })

  describe('Hash Parameter Fallback', () => {
    it('should extract parameters from hash when query params are missing', async () => {
      mockRoute.query = {}
      window.location.hash = '#token=hash-token&type=email'

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'hash-token',
        type: 'email',
      })
    })

    it('should prioritize query params over hash params', async () => {
      mockRoute.query = { token: 'query-token', type: 'email' }
      window.location.hash = '#token=hash-token&type=signup'

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'query-token',
        type: 'email',
      })
    })
  })

  describe('Invalid/Missing Parameters', () => {
    it('should show invalid link message for missing parameters', async () => {
      mockRoute.query = {}
      window.location.hash = ''

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Invalid Confirmation Link')
      expect(wrapper.text()).toContain('appears to be invalid or has expired')
    })

    it('should show invalid link for unrecognized type', async () => {
      mockRoute.query = { token: 'test-token', type: 'unknown' }

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      expect(wrapper.text()).toContain('Unable to determine confirmation type')
    })
  })

  describe('Retry Functionality', () => {
    it('should retry confirmation on button click', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockSupabaseClient.auth.verifyOtp
        .mockResolvedValueOnce({ error: { message: 'Network error' } })
        .mockResolvedValueOnce({ error: null })

      const wrapper = mount(TeamAuthConfirmation)

      await nextTick()
      await nextTick()

      // Should show error first
      expect(wrapper.text()).toContain('Network error')

      // Click retry button
      await wrapper.find('button').trigger('click')
      await nextTick()

      // Should show success after retry
      expect(wrapper.text()).toContain('Email Confirmed!')
    })
  })

  describe('Redirect Functionality', () => {
    it('should redirect after successful confirmation', async () => {
      mockRoute.query = {
        token: 'test-token',
        type: 'email',
        redirect_to: '/dashboard',
      }

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation, {
        props: { redirectUrl: '/default' },
      })

      await nextTick()
      await nextTick()

      // Click continue button
      await wrapper.find('button').trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })

    it('should use default redirect URL when none provided', async () => {
      mockRoute.query = { token: 'test-token', type: 'email' }

      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      })

      const wrapper = mount(TeamAuthConfirmation, {
        props: { redirectUrl: '/default-page' },
      })

      await nextTick()
      await nextTick()

      // Click continue button
      await wrapper.find('button').trigger('click')

      expect(mockRouter.push).toHaveBeenCalledWith('/default-page')
    })
  })

  describe('Debug Mode', () => {
    it('should log parameters in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockRoute.query = { token: 'test-token', type: 'email' }

      mount(TeamAuthConfirmation, {
        props: { debug: true },
      })

      await nextTick()

      expect(consoleSpy).toHaveBeenCalledWith('Confirmation parameters:', expect.any(Object))

      consoleSpy.mockRestore()
    })
  })
})

import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock Nuxt route middleware function globally
Object.assign(globalThis, {
  defineNuxtRouteMiddleware: (fn: any) => fn,
  navigateTo: vi.fn(),
  $fetch: vi.fn().mockImplementation(async (url: string, _options: any) => {
    // Default success responses for common API endpoints
    const responses: Record<string, any> = {
      '/api/signup-with-team': { success: true },
      '/api/invite-member': { success: true },
      '/api/get-pending-invitations': { success: true, invitations: [] },
      '/api/revoke-invitation': { success: true },
      '/api/transfer-ownership': { success: true },
      '/api/delete-user': { success: true },
    }
    return responses[url] || { success: true }
  }),
  useRuntimeConfig: () => ({
    public: {
      teamAuth: {
        loginPage: '/signin',
      },
    },
  }),
})

// Mock ofetch
vi.mock('ofetch', () => ({
  $fetch: vi.fn().mockImplementation(async (url: string, _options: any) => {
    // Default success responses for common API endpoints
    const responses: Record<string, any> = {
      '/api/signup-with-team': { success: true },
      '/api/invite-member': { success: true },
      '/api/get-pending-invitations': { success: true, invitations: [] },
      '/api/revoke-invitation': { success: true },
      '/api/transfer-ownership': { success: true },
      '/api/delete-user': { success: true },
    }
    return responses[url] || { success: true }
  }),
}))

// Mock Nuxt composables and plugins
vi.mock('#app', () => ({
  navigateTo: vi.fn(),
  defineNuxtRouteMiddleware: (fn: any) => fn,
  useRuntimeConfig: () => ({
    public: {
      teamAuth: {
        loginPage: '/signin',
      },
    },
  }),
  useRoute: () => ({
    query: {},
    params: {},
    path: '/test',
    search: '',
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useState: vi.fn(),
  useNuxtApp: () => ({
    $supabase: {
      client: {
        auth: {
          getSession: vi.fn(),
          signUp: vi.fn(),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
          onAuthStateChange: vi.fn(),
          setSession: vi.fn(),
          verifyOtp: vi.fn(),
          updateUser: vi.fn(),
          signInWithOAuth: vi.fn(),
        },
        functions: {
          invoke: vi.fn(),
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
      },
    },
  }),
}))

// Mock #imports for all Nuxt utilities and composables
vi.mock('#imports', () => ({
  navigateTo: vi.fn(),
  defineNuxtRouteMiddleware: (fn: any) => fn,
  useRuntimeConfig: () => ({
    public: {
      teamAuth: {
        loginPage: '/signin',
      },
    },
  }),
  useRoute: () => ({
    query: {},
    params: {},
    path: '/test',
    search: '',
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useState: vi.fn(),
  useNuxtApp: () => ({
    $supabase: {
      client: {
        auth: {
          getSession: vi.fn(),
          signUp: vi.fn(),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
          onAuthStateChange: vi.fn(),
          setSession: vi.fn(),
          verifyOtp: vi.fn(),
          updateUser: vi.fn(),
          signInWithOAuth: vi.fn(),
        },
        functions: {
          invoke: vi.fn(),
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
      },
    },
  }),
  useToast: () => ({
    add: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
    params: {},
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Global test configuration
config.global.mocks = {
  $supabase: {
    client: {
      auth: {
        getSession: vi.fn(),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn(),
        setSession: vi.fn(),
        verifyOtp: vi.fn(),
        updateUser: vi.fn(),
        signInWithOAuth: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
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
    },
  },
}

// Global storage mocks
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// Mock localStorage and sessionStorage
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

// Also set on window for components
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  })
}

// Make base64 functions available globally
if (!global.btoa) {
  global.btoa = (str: string) => Buffer.from(str).toString('base64')
}

if (!global.atob) {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString()
}

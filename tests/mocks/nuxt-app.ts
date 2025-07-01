import { vi } from 'vitest'

export const useNuxtApp = vi.fn(() => ({
  $teamAuthClient: {
    auth: {
      getSession: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
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
  // Add $supabase for our new composables
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
}))

export const useRoute = vi.fn(() => ({
  query: {},
  params: {},
}))

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

export const useState = vi.fn((key: string, init?: () => any) => ({
  value: init ? init() : null,
}))

export const navigateTo = vi.fn()
export const defineNuxtRouteMiddleware = vi.fn((fn: any) => fn)
export const useRuntimeConfig = vi.fn(() => ({
  public: {
    teamAuth: {
      loginPage: '/signin',
    },
  },
}))

import { vi } from 'vitest'

// Mock Supabase client - comprehensive mock
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ 
      data: { 
        session: {
          user: { 
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' }
          }
        }
      }, 
      error: null 
    }),
    onAuthStateChange: vi.fn().mockReturnValue({ 
      data: { 
        subscription: { unsubscribe: vi.fn() } 
      } 
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}

export const useSupabaseClient = vi.fn(() => mockSupabaseClient)
export const useSupabaseSession = vi.fn(() => null)
export const useSupabaseUser = vi.fn(() => null)
export const useRoute = vi.fn(() => ({
  query: {},
  params: {},
  hash: '',
}))
export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))
export const navigateTo = vi.fn()
export const useRuntimeConfig = vi.fn(() => ({
  public: {
    supabase: {
      url: 'http://localhost:54321',
      anonKey: 'test-anon-key'
    }
  },
  supabase: {
    serviceKey: 'test-service-key'
  }
}))
// Type shims for Nuxt auto-imports
// These modules are provided by Nuxt at runtime

declare module '#imports' {
  import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
  import type { Ref } from 'vue'

  export const useRuntimeConfig: () => {
    supabaseUrl?: string
    supabaseKey?: string
    supabaseServiceKey?: string
    public: {
      teamAuth?: {
        redirectTo?: string
        loginPage?: string
        debug?: boolean
        socialProviders?: Record<string, { enabled: boolean }>
      }
      supabase?: {
        url: string
        key: string
      }
    }
  }
  export const navigateTo: (path: string, options?: { replace?: boolean, external?: boolean }) => Promise<void> | void
  export const defineNuxtRouteMiddleware: <T>(middleware: T) => T
  export const useState: <T>(key: string, init?: () => T) => Ref<T>
  export const useCookie: <T>(name: string, options?: object) => Ref<T | null>
  export const useNuxtApp: () => {
    $supabase?: {
      client: unknown
    }
  }
  export const definePageMeta: (meta: Record<string, unknown>) => void
  export const createError: (options: { statusCode: number, message: string }) => Error
  export const useRoute: () => RouteLocationNormalizedLoaded
  export const useRouter: () => Router
  export const useToast: () => {
    add: (options: { title?: string, description?: string, color?: string, icon?: string }) => void
  }
  export const computed: typeof import('vue').computed
  export const ref: typeof import('vue').ref
  export const watch: typeof import('vue').watch
  export const onMounted: typeof import('vue').onMounted
  export const onUnmounted: typeof import('vue').onUnmounted
}

declare module '#supabase/server' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { H3Event } from 'h3'
  import type { Database } from './database.types'

  export function serverSupabaseClient<T = Database>(event: H3Event): SupabaseClient<T>
  export function serverSupabaseServiceRole<T = Database>(event: H3Event): SupabaseClient<T>
  export function serverSupabaseUser(event: H3Event): Promise<{ id: string, email?: string } | null>
}

declare module '#supabase/client' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { Database } from './database.types'

  export function useSupabaseClient<T = Database>(): SupabaseClient<T>
  export function useSupabaseUser(): import('vue').Ref<{ id: string, email?: string } | null>
  export function useSupabaseSession(): import('vue').Ref<unknown>
}

declare module '#app' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { Ref } from 'vue'

  export const useNuxtApp: () => {
    $supabase?: {
      client: SupabaseClient
    }
  }
  export const useState: <T>(key: string, init?: () => T) => Ref<T>
}

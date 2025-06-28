// Server utilities for module code - using direct @supabase/supabase-js imports
// Module code cannot rely on @nuxtjs/supabase internal paths since they're not exported
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'

// Create service role client
export function createServiceRoleClient(event: H3Event) {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.supabaseUrl || config.public?.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service key')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Get current user from event (placeholder - consumers should use @nuxtjs/supabase directly)
export function getCurrentUser(event: H3Event) {
  // This is a placeholder - in actual usage, consumers should use serverSupabaseUser from @nuxtjs/supabase
  throw new Error('getCurrentUser should be imported from #supabase/server in your app code, not from the module')
}

// Create client from event (placeholder - consumers should use @nuxtjs/supabase directly)
export function createSupabaseClientFromEvent(event: H3Event) {
  // This is a placeholder - in actual usage, consumers should use serverSupabaseClient from @nuxtjs/supabase
  throw new Error('createSupabaseClientFromEvent should be imported from #supabase/server in your app code, not from the module')
}

// Backward compatibility exports (deprecated - use direct @nuxtjs/supabase imports in app code)
export const serverSupabaseServiceRole = createServiceRoleClient
export const serverSupabaseClient = createSupabaseClientFromEvent  
export const serverSupabaseUser = getCurrentUser
export const serverSupabaseSession = createSupabaseClientFromEvent

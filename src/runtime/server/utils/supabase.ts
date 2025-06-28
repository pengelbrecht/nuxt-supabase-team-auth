/**
 * Server utilities that use @nuxtjs/supabase's server services
 * This provides a clean abstraction while delegating to the official implementation
 */

// Re-export @nuxtjs/supabase server utilities
export {
  serverSupabaseServiceRole,
  serverSupabaseClient,
  serverSupabaseUser,
  serverSupabaseSession,
} from '#supabase/server'

// Backward compatibility aliases
export {
  serverSupabaseServiceRole as createServiceRoleClient,
  serverSupabaseClient as createSupabaseClientFromEvent,
  serverSupabaseUser as getCurrentUser,
} from '#supabase/server'

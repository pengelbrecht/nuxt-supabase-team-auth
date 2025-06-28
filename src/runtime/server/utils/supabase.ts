// Re-export server utilities from @nuxtjs/supabase
export { serverSupabaseServiceRole as createServiceRoleClient } from '#supabase/server'
export { serverSupabaseUser as getCurrentUser } from '#supabase/server'
export { serverSupabaseClient as createSupabaseClientFromEvent } from '#supabase/server'

// For backward compatibility, also export the @nuxtjs/supabase utilities directly
export {
  serverSupabaseServiceRole,
  serverSupabaseClient,
  serverSupabaseUser,
  serverSupabaseSession,
} from '#supabase/server'

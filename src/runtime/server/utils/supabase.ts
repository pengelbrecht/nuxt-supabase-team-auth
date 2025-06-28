// Re-export server utilities from @nuxtjs/supabase
// Since @nuxtjs/supabase is our dependency, we can import from it directly
export { 
  serverSupabaseServiceRole as createServiceRoleClient,
  serverSupabaseUser as getCurrentUser,
  serverSupabaseClient as createSupabaseClientFromEvent,
  // For backward compatibility, also export the @nuxtjs/supabase utilities directly
  serverSupabaseServiceRole,
  serverSupabaseClient,
  serverSupabaseUser,
  serverSupabaseSession,
} from '@nuxtjs/supabase/dist/runtime/server/services/index.js'

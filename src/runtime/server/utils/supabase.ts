// Re-export server utilities from @nuxtjs/supabase
// Note: Use direct import from package instead of #supabase/server alias
// since module code can't access consuming app's aliases
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

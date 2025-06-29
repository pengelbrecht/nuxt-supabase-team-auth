/**
 * Server utilities compatible with @nuxtjs/supabase
 * These implementations mirror @nuxtjs/supabase's server utilities using direct SDK imports
 */
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'

/**
 * Create a Supabase service role client (compatible with @nuxtjs/supabase)
 * This mirrors the implementation from @nuxtjs/supabase
 */
export const serverSupabaseServiceRole = (event: H3Event) => {
  const {
    supabase: { serviceKey },
    public: {
      supabase: { url },
    },
  } = useRuntimeConfig(event)

  if (!serviceKey) {
    throw new Error('Missing `SUPABASE_SERVICE_KEY` in `.env`')
  }

  if (!event.context._supabaseServiceRole) {
    event.context._supabaseServiceRole = createClient(url, serviceKey, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return event.context._supabaseServiceRole
}

/**
 * Create a Supabase client for the current user
 * This mirrors the implementation from @nuxtjs/supabase
 */
export const serverSupabaseClient = (event: H3Event) => {
  const {
    public: {
      supabase: { url, key },
    },
  } = useRuntimeConfig(event)

  if (!event.context._supabaseClient) {
    event.context._supabaseClient = createClient(url, key, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return event.context._supabaseClient
}

/**
 * Get the current user from the session
 * This mirrors the implementation from @nuxtjs/supabase
 */
export const serverSupabaseUser = async (event: H3Event) => {
  const client = serverSupabaseClient(event)
  const { data: { user }, error } = await client.auth.getUser()
  
  if (error) {
    return null
  }
  
  return user
}

/**
 * Get the current session
 * This mirrors the implementation from @nuxtjs/supabase
 */
export const serverSupabaseSession = async (event: H3Event) => {
  const client = serverSupabaseClient(event)
  const { data: { session }, error } = await client.auth.getSession()
  
  if (error) {
    return null
  }
  
  return session
}

// Backward compatibility aliases
export const createServiceRoleClient = serverSupabaseServiceRole
export const createSupabaseClientFromEvent = serverSupabaseClient
export const getCurrentUser = serverSupabaseUser

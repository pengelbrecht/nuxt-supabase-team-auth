import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

export function createServiceRoleClient() {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.teamAuth?.supabaseUrl || config.supabaseUrl
  const serviceKey = config.supabaseServiceKey

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase URL and service key are required')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getCurrentUser(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.teamAuth?.supabaseUrl || config.supabaseUrl
  const anonKey = config.public.teamAuth?.supabaseKey || config.supabaseAnonKey

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase configuration missing')
  }

  const client = createClient(supabaseUrl, anonKey)
  const { data: { user }, error } = await client.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user
}

export function createSupabaseClientFromEvent(event: H3Event) {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.teamAuth?.supabaseUrl || config.supabaseUrl
  const anonKey = config.public.teamAuth?.supabaseKey || config.supabaseAnonKey

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase configuration missing')
  }

  const authHeader = getHeader(event, 'authorization')

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authHeader
        ? {
            Authorization: authHeader,
          }
        : {},
    },
  })
}

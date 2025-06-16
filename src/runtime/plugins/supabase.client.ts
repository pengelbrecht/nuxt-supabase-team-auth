import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  
  // Try to get from teamAuth config first, then fallback to direct config
  const supabaseUrl = config.public.teamAuth?.supabaseUrl || config.public.supabaseUrl
  const supabaseAnonKey = config.public.teamAuth?.supabaseKey || config.public.supabaseAnonKey
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables or configure teamAuth module options.')
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  return {
    provide: {
      teamAuthClient: supabase
    }
  }
})
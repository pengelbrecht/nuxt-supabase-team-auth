import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  
  // Try to get from teamAuth config first, then fallback to direct config
  const supabaseUrl = config.public.teamAuth?.supabaseUrl || config.public.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase server configuration missing. Server-side operations may not work.')
    return { provide: { teamAuthServerClient: null } }
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  return {
    provide: {
      teamAuthServerClient: supabase
    }
  }
})
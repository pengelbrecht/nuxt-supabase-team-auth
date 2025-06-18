import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StopImpersonationRequest {
  admin_user_id?: string
  target_user_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse request body (optional - can provide specific user IDs)
    const body = await req.json().catch(() => ({}))
    const { admin_user_id, target_user_id } = body as StopImpersonationRequest

    // Build query to find open impersonation sessions
    // This approach is more robust - it finds sessions based on either the admin or target user
    let query = supabaseAdmin
      .from('impersonation_sessions')
      .select('*')
      .is('ended_at', null) // Only active sessions

    if (admin_user_id && target_user_id) {
      // Specific session requested
      query = query.eq('admin_user_id', admin_user_id).eq('target_user_id', target_user_id)
    }
    else if (admin_user_id) {
      // All sessions by this admin
      query = query.eq('admin_user_id', admin_user_id)
    }
    else if (target_user_id) {
      // Sessions targeting this user
      query = query.eq('target_user_id', target_user_id)
    }
    else {
      // Check if current user is involved in any sessions (as admin or target)
      query = query.or(`admin_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
    }

    const { data: sessions, error: sessionError } = await query

    if (sessionError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to query impersonation sessions',
          details: sessionError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'SESSION_NOT_FOUND',
          message: 'No active impersonation sessions found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Update all found sessions to mark them as ended
    const sessionIds = sessions.map(s => s.id)
    const { error: updateError } = await supabaseAdmin
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .in('id', sessionIds)

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to end impersonation sessions',
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        ended_sessions: sessions.map(session => ({
          id: session.id,
          admin_user_id: session.admin_user_id,
          target_user_id: session.target_user_id,
          started_at: session.started_at,
          ended_at: new Date().toISOString(),
          reason: session.reason,
        })),
        message: `Successfully ended ${sessions.length} impersonation session(s)`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in stop-impersonation:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

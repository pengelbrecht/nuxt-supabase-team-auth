import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StartImpersonationRequest {
  target_user_id: string
  reason: string
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

    // Parse request body
    const { target_user_id, reason }: StartImpersonationRequest = await req.json()

    if (!target_user_id || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing target_user_id or reason' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify current user is a super admin
    const { data: adminMembership, error: adminError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single()

    if (adminError || !adminMembership) {
      return new Response(
        JSON.stringify({
          error: 'IMPERSONATION_UNAUTHORIZED',
          message: 'Only super admins can start impersonation sessions',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify target user exists
    const { data: targetUser, error: targetError } = await supabaseAdmin.auth.admin.getUserById(target_user_id)
    if (targetError || !targetUser.user) {
      return new Response(
        JSON.stringify({
          error: 'USER_NOT_FOUND',
          message: 'Target user does not exist',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Prevent self-impersonation
    if (target_user_id === user.id) {
      return new Response(
        JSON.stringify({
          error: 'SELF_IMPERSONATION',
          message: 'Cannot impersonate yourself',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // TODO: Add MFA verification here
    // For now, we'll skip MFA but this should be implemented in production
    // const mfaRequired = await verifyMFA(user.id, req)
    // if (!mfaRequired) {
    //   return new Response(
    //     JSON.stringify({ error: 'MFA_REQUIRED', message: 'MFA verification required for impersonation' }),
    //     { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    //   )
    // }

    // Create impersonation session record
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('impersonation_sessions')
      .insert({
        admin_user_id: user.id,
        target_user_id: target_user_id,
        reason: reason,
      })
      .select()
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({
          error: 'Failed to create impersonation session',
          details: sessionError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Use magic-link verification pattern to create session for target user
    // Step 1: Generate magic link (but don't send email)
    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email!,
      options: {
        data: {
          // Include impersonation metadata
          act_as: true,
          original_admin_id: user.id,
          impersonation_session_id: session.id,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        },
      },
    })

    if (magicLinkError || !magicLinkData.properties?.hashed_token) {
      return new Response(
        JSON.stringify({
          error: 'Failed to generate magic link for impersonation',
          details: magicLinkError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Step 2: Immediately verify the OTP to create valid session
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: magicLinkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyError || !sessionData.session) {
      return new Response(
        JSON.stringify({
          error: 'Failed to verify impersonation session',
          details: verifyError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Return success response with both sessions (dual-session pattern)
    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session, // Impersonated user's session
        originalSession: {
          access_token: authHeader.replace('Bearer ', ''),
          user: {
            id: user.id,
            email: user.email,
          },
        }, // Admin's original session for restoration
        impersonation_log: {
          id: session.id,
          admin_user_id: user.id,
          target_user_id: target_user_id,
          started_at: session.started_at,
          reason: reason,
        },
        target_user: {
          id: targetUser.user.id,
          email: targetUser.user.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in start-impersonation:', error)

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

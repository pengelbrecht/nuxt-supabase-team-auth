import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateTeamRequest {
  email: string
  password: string
  team_name: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request body
    const { email, password, team_name }: CreateTeamRequest = await req.json()

    // Validate input
    if (!email || !password || !team_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, team_name' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate team name is not empty
    if (team_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Team name cannot be empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if team name already exists
    const { data: existingTeam } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('name', team_name)
      .single()

    if (existingTeam) {
      return new Response(
        JSON.stringify({ error: 'TEAM_EXISTS', message: 'Team name already in use' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for this flow
    })

    if (authError || !authData.user) {
      // Check if it's a duplicate email error
      if (authError?.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ 
            error: 'EMAIL_ALREADY_EXISTS', 
            message: 'A user with this email address already exists' 
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user account', details: authError?.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userId = authData.user.id

    // Start transaction: Create team and add owner
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: team_name,
      })
      .select()
      .single()

    if (teamError || !team) {
      // Cleanup: Delete the created user if team creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to create team', details: teamError?.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Add user as team owner
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner'
      })

    if (memberError) {
      // Cleanup: Delete team and user if member addition fails
      await supabaseAdmin.from('teams').delete().eq('id', team.id)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to add user as team owner', details: memberError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate session with team claims
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/dashboard`
      }
    })

    if (sessionError) {
      console.error('Failed to generate session:', sessionError)
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: userId,
          email: authData.user.email
        },
        team: {
          id: team.id,
          name: team.name
        },
        session_url: sessionData?.properties?.action_link || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error in create-team-and-owner:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
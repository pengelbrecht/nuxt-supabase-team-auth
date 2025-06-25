import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CreateTeamRequest {
  email: string
  password?: string // Optional for Google OAuth users
  team_name: string
  oauth_provider?: string // 'google' for OAuth users
  user_metadata?: any // Google profile data for OAuth users
}

serve(async (req) => {
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok')
  }

  try {
    // Initialize Supabase client with service role key
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

    // For OAuth users, also create a client with the user's session
    const authHeader = req.headers.get('Authorization')
    let userSupabase = null

    if (authHeader) {
      userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        },
      )
    }

    // Parse request body
    const { email, password, team_name, oauth_provider }: CreateTeamRequest = await req.json()

    // Validate input - password not required for OAuth users
    if (!email || !team_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, team_name' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // For non-OAuth users, password is required
    if (!oauth_provider && !password) {
      return new Response(
        JSON.stringify({ error: 'Password is required for non-OAuth signup' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate team name is not empty
    if (team_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Team name cannot be empty' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
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
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    let userId: string
    let authData: any

    if (oauth_provider === 'google') {
      // For Google OAuth users, get the current authenticated user from the session
      if (!userSupabase) {
        return new Response(
          JSON.stringify({
            error: 'MISSING_AUTH_TOKEN',
            message: 'Authorization token required for OAuth signup',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      const { data: { user }, error: getUserError } = await userSupabase.auth.getUser()

      if (getUserError || !user) {
        return new Response(
          JSON.stringify({
            error: 'OAUTH_USER_NOT_FOUND',
            message: 'Could not get authenticated user from session',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      userId = user.id
      authData = { user }

      console.log('Found authenticated Google OAuth user:', user.email, 'ID:', userId)
    }
    else {
      // Create new user account for password-based signup
      const createUserResult = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email for this flow
      })

      if (createUserResult.error || !createUserResult.data.user) {
        // Check if it's a duplicate email error
        if (createUserResult.error?.message?.includes('already been registered')) {
          return new Response(
            JSON.stringify({
              error: 'EMAIL_ALREADY_EXISTS',
              message: 'A user with this email address already exists',
            }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        return new Response(
          JSON.stringify({ error: 'Failed to create user account', details: createUserResult.error?.message }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      userId = createUserResult.data.user.id
      authData = createUserResult.data

      console.log('Created new password user:', email, 'ID:', userId)
    }

    // Start transaction: Create team and add owner
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: team_name,
      })
      .select()
      .single()

    if (teamError || !team) {
      // Cleanup: Only delete user if it was created for password signup (not OAuth)
      if (oauth_provider !== 'google') {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create team', details: teamError?.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Add user as team owner
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner',
      })

    if (memberError) {
      // Cleanup: Delete team and user (if password signup) if member addition fails
      await supabaseAdmin.from('teams').delete().eq('id', team.id)
      if (oauth_provider !== 'google') {
        await supabaseAdmin.auth.admin.deleteUser(userId)
      }

      return new Response(
        JSON.stringify({ error: 'Failed to add user as team owner', details: memberError.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Generate session with team claims
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/dashboard`,
      },
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
          email: authData.user.email,
        },
        team: {
          id: team.id,
          name: team.name,
        },
        session_url: sessionData?.properties?.action_link || null,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in create-team-and-owner:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})

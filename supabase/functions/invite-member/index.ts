import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface InviteMemberRequest {
  email: string
  team_id?: string
  teamId?: string // Alternative naming from frontend
  role?: string
}

serve(async (req) => {
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok')
  }

  try {
    // Get user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse request body
    const { email, team_id, teamId, role }: InviteMemberRequest = await req.json()

    // Support both team_id and teamId naming
    const finalTeamId = team_id || teamId
    const inviteRole = role || 'member'

    if (!email || !finalTeamId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, team_id/teamId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify user has permission to invite (admin or owner)
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', finalTeamId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'User is not a member of this team' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (!['owner', 'admin', 'super_admin'].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: 'ROLE_FORBIDDEN', message: 'Only owners, admins, and super_admins can invite members' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check if user is already a member or has a pending invitation
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Check if user is already a team member
      const { data: existingMember } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('team_id', finalTeamId)
        .single()

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this team' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Check if user has unconfirmed invitation (email_confirmed_at is null)
      // Fixed: existingUser is the user object directly, not wrapped in .user
      if (!existingUser.email_confirmed_at) {
        return new Response(
          JSON.stringify({ error: 'User already has a pending invitation' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // User exists and is confirmed - check if they're on ANY team
      const { data: existingTeamMembership } = await supabaseAdmin
        .from('team_members')
        .select('team_id')
        .eq('user_id', existingUser.id)
        .single()

      if (existingTeamMembership) {
        return new Response(
          JSON.stringify({ error: 'This user is already a member of another team' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // User exists but has no team membership - this shouldn't normally happen
      // but if it does, we can add them to this team
      console.log(`Adding existing user ${email} with no team membership to team ${finalTeamId}`)

      const { error: memberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          team_id: finalTeamId,
          user_id: existingUser.id,
          role: inviteRole,
        })

      if (memberError) {
        return new Response(
          JSON.stringify({
            error: 'Failed to add user to team',
            details: memberError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Get team info for response
      const { data: team } = await supabaseAdmin
        .from('teams')
        .select('name')
        .eq('id', finalTeamId)
        .single()

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User added to team successfully',
          team: {
            id: finalTeamId,
            name: team?.name,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get team info for the invite metadata (for NEW users only)
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', finalTeamId)
      .single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Send invite using Supabase's built-in system for NEW users
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000'
    const redirectUrl = `${siteUrl}/accept-invite?team_id=${finalTeamId}`

    console.log('SITE_URL env var:', Deno.env.get('SITE_URL'))
    console.log('Computed site URL:', siteUrl)
    console.log('Full redirect URL:', redirectUrl)

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          team_id: finalTeamId,
          team_name: team.name,
          invited_by: user.id,
          invited_by_email: user.email,
          role: inviteRole,
        },
        redirectTo: redirectUrl,
      },
    )

    if (inviteError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to send invitation',
          details: inviteError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        invited_user: inviteData.user,
        team: {
          id: finalTeamId,
          name: team.name,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in invite-member:', error)

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

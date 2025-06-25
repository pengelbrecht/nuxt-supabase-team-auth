import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GetPendingInvitationsRequest {
  teamId: string
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
    const { teamId }: GetPendingInvitationsRequest = await req.json()

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'Missing teamId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify user has permission to view invitations (admin or owner)
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
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
        JSON.stringify({ error: 'Only owners, admins, and super_admins can view invitations' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get all users with null email_confirmed_at (pending invitations)
    const { data: allUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch users',
          details: usersError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get all team members for this team
    const { data: teamMembers, error: membersError } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    if (membersError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch team members',
          details: membersError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const teamMemberIds = new Set(teamMembers.map(m => m.user_id))

    // Filter for pending invitations - users with team metadata but not yet in team_members
    // Also filter out expired invitations (older than 24 hours)
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const pendingInvitations = allUsers.users
      .filter((user) => {
        // Must have team metadata and not be in team_members
        const hasTeamMetadata = user.user_metadata?.team_id === teamId
        const notInTeam = !teamMemberIds.has(user.id)

        // Must be unconfirmed (pending invitation)
        const isUnconfirmed = user.email_confirmed_at === null

        // Check if invitation is still valid (not expired)
        const inviteDate = user.invited_at ? new Date(user.invited_at) : null
        const notExpired = inviteDate && inviteDate > twentyFourHoursAgo

        return hasTeamMetadata && notInTeam && isUnconfirmed && notExpired
      })
      .map(user => ({
        id: user.id,
        email: user.email,
        invited_at: user.invited_at,
        invited_by: user.user_metadata?.invited_by_email || 'Unknown',
        role: user.user_metadata?.role || 'member',
        team_name: user.user_metadata?.team_name,
        expires_at: user.invited_at ? new Date(new Date(user.invited_at).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
      }))

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        invitations: pendingInvitations,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in get-pending-invitations:', error)

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

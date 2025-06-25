import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RevokeInvitationRequest {
  userId: string
  teamId: string
}

serve(async (req) => {
  console.log('=== REVOKE INVITATION EDGE FUNCTION CALLED ===')
  console.log('Method:', req.method)

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
    const { userId, teamId }: RevokeInvitationRequest = await req.json()

    console.log('Revoke invitation request:', { userId, teamId })

    if (!userId || !teamId) {
      console.log('Missing required fields:', { userId: !!userId, teamId: !!teamId })
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, teamId',
          debug: { userId: !!userId, teamId: !!teamId, receivedData: { userId, teamId } },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify user has permission to revoke invitations (admin or owner)
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
        JSON.stringify({ error: 'Only owners, admins, and super_admins can revoke invitations' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get the user to verify it's an unconfirmed invitation for this team
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (getUserError || !targetUser.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify this is an unconfirmed invitation for the specified team
    console.log('=== FULL USER OBJECT DEBUG ===')
    console.log('targetUser structure:', JSON.stringify(targetUser, null, 2))
    console.log('targetUser.user:', JSON.stringify(targetUser.user, null, 2))

    // Check confirmation fields - user is confirmed only if either field exists and has a date value
    const emailConfirmedAt = targetUser.user.email_confirmed_at
    const confirmedAt = targetUser.user.confirmed_at

    // User is confirmed only if the fields exist and are not null/undefined
    const isConfirmed = (emailConfirmedAt != null && emailConfirmedAt !== '')
      || (confirmedAt != null && confirmedAt !== '')

    console.log('Confirmation check:', {
      emailConfirmedAt,
      confirmedAt,
      isConfirmed,
      hasEmailConfirmedField: 'email_confirmed_at' in targetUser.user,
      hasConfirmedAtField: 'confirmed_at' in targetUser.user,
    })

    if (isConfirmed) {
      console.log('User has already confirmed their account')
      return new Response(
        JSON.stringify({
          error: 'User has already confirmed their account',
          debug: {
            email_confirmed_at: emailConfirmedAt,
            confirmed_at: confirmedAt,
            emailConfirmedAtType: typeof emailConfirmedAt,
            confirmedAtType: typeof confirmedAt,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (targetUser.user.user_metadata?.team_id !== teamId) {
      console.log('Team ID mismatch:', {
        userTeamId: targetUser.user.user_metadata?.team_id,
        requestedTeamId: teamId,
      })
      return new Response(
        JSON.stringify({ error: 'Invitation is not for this team' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Delete the unconfirmed user (this revokes the invitation)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to revoke invitation',
          details: deleteError.message,
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
        message: 'Invitation revoked successfully',
        revoked_user: {
          id: targetUser.user.id,
          email: targetUser.user.email,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in revoke-invitation:', error)

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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TransferOwnershipRequest {
  new_owner_id: string
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
    const { new_owner_id }: TransferOwnershipRequest = await req.json()

    if (!new_owner_id) {
      return new Response(
        JSON.stringify({ error: 'Missing new_owner_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify current user is a team owner
    const { data: currentOwnership, error: ownershipError } = await supabaseAdmin
      .from('team_members')
      .select(`
        *,
        teams!inner(id, name)
      `)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (ownershipError || !currentOwnership) {
      return new Response(
        JSON.stringify({
          error: 'ROLE_FORBIDDEN',
          message: 'Only team owners can transfer ownership',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const teamId = currentOwnership.team_id

    // Check if new owner is a member of the team
    const { data: newOwnerMembership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', new_owner_id)
      .single()

    if (membershipError || !newOwnerMembership) {
      return new Response(
        JSON.stringify({
          error: 'USER_NOT_MEMBER',
          message: 'New owner must be a member of the team',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Prevent transferring to self
    if (new_owner_id === user.id) {
      return new Response(
        JSON.stringify({
          error: 'SELF_TRANSFER',
          message: 'Cannot transfer ownership to yourself',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Start transaction: Update roles
    // 1. Promote new owner
    const { error: promoteError } = await supabaseAdmin
      .from('team_members')
      .update({ role: 'owner' })
      .eq('team_id', teamId)
      .eq('user_id', new_owner_id)

    if (promoteError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to promote new owner',
          details: promoteError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // 2. Demote previous owner to admin
    const { error: demoteError } = await supabaseAdmin
      .from('team_members')
      .update({ role: 'admin' })
      .eq('team_id', teamId)
      .eq('user_id', user.id)

    if (demoteError) {
      // Rollback: Revert new owner promotion
      await supabaseAdmin
        .from('team_members')
        .update({ role: newOwnerMembership.role })
        .eq('team_id', teamId)
        .eq('user_id', new_owner_id)

      return new Response(
        JSON.stringify({
          error: 'Failed to demote previous owner',
          details: demoteError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get updated team information
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    // Get new owner user information
    const { data: newOwnerUser } = await supabaseAdmin.auth.admin.getUserById(new_owner_id)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        team: {
          id: teamId,
          name: team?.name,
        },
        previous_owner: {
          id: user.id,
          email: user.email,
          new_role: 'admin',
        },
        new_owner: {
          id: new_owner_id,
          email: newOwnerUser.user?.email,
          role: 'owner',
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in transfer-ownership:', error)

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

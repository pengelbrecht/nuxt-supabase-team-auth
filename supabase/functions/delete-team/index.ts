import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DeleteTeamRequest {
  team_id: string
  confirm_deletion: boolean
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
    const { team_id, confirm_deletion }: DeleteTeamRequest = await req.json()

    if (!team_id) {
      return new Response(
        JSON.stringify({ error: 'Missing team_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (!confirm_deletion) {
      return new Response(
        JSON.stringify({
          error: 'CONFIRMATION_REQUIRED',
          message: 'Team deletion requires explicit confirmation via confirm_deletion: true',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify current user is an owner of the team
    const { data: ownership, error: ownershipError } = await supabaseAdmin
      .from('team_members')
      .select(`
        *,
        teams!inner(id, name)
      `)
      .eq('user_id', user.id)
      .eq('team_id', team_id)
      .eq('role', 'owner')
      .single()

    if (ownershipError || !ownership) {
      return new Response(
        JSON.stringify({
          error: 'ROLE_FORBIDDEN',
          message: 'Only team owners can delete teams',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const team = ownership.teams

    // Get all team members for cleanup tracking
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('team_members')
      .select(`
        user_id,
        role,
        profiles!inner(email, full_name)
      `)
      .eq('team_id', team_id)

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

    // Perform comprehensive team deletion with proper transaction handling
    const { error: deletionError } = await supabaseAdmin.rpc(
      'delete_team_comprehensive',
      { team_id_param: team_id },
    )

    if (deletionError) {
      // If the function doesn't exist, fall back to manual deletion with trigger management
      console.log('Comprehensive deletion function not found, using manual approach')

      try {
        // Step 1: Temporarily disable the owner constraint trigger
        const { error: disableTriggerError } = await supabaseAdmin.rpc('sql', {
          query: 'ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner_trigger;',
        })

        if (disableTriggerError) {
          console.warn('Could not disable trigger (may not exist):', disableTriggerError.message)
        }

        // Step 2: Delete all team members
        const { error: deleteMembersError } = await supabaseAdmin
          .from('team_members')
          .delete()
          .eq('team_id', team_id)

        if (deleteMembersError) {
          // Re-enable trigger before returning error
          await supabaseAdmin.rpc('sql', {
            query: 'ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;',
          })

          return new Response(
            JSON.stringify({
              error: 'Failed to delete team members',
              details: deleteMembersError.message,
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Step 3: Delete impersonation sessions for this team
        const { error: deleteImpersonationError } = await supabaseAdmin
          .from('impersonation_sessions')
          .delete()
          .in('target_user_id', allMembers?.map(m => m.user_id) || [])

        if (deleteImpersonationError) {
          console.warn('Could not delete impersonation sessions:', deleteImpersonationError.message)
        }

        // Step 4: Delete the team itself
        const { error: deleteTeamError } = await supabaseAdmin
          .from('teams')
          .delete()
          .eq('id', team_id)

        if (deleteTeamError) {
          // Re-enable trigger before returning error
          await supabaseAdmin.rpc('sql', {
            query: 'ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;',
          })

          return new Response(
            JSON.stringify({
              error: 'Failed to delete team',
              details: deleteTeamError.message,
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Step 5: Re-enable the trigger
        const { error: enableTriggerError } = await supabaseAdmin.rpc('sql', {
          query: 'ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;',
        })

        if (enableTriggerError) {
          console.warn('Could not re-enable trigger:', enableTriggerError.message)
        }
      }
      catch (manualError) {
        // Ensure trigger is re-enabled even if manual deletion fails
        await supabaseAdmin.rpc('sql', {
          query: 'ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;',
        })

        return new Response(
          JSON.stringify({
            error: 'Manual deletion failed',
            details: manualError instanceof Error ? manualError.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
    }

    // Return success response with deletion summary
    return new Response(
      JSON.stringify({
        success: true,
        deleted_team: {
          id: team_id,
          name: team.name,
        },
        members_removed: allMembers?.length || 0,
        members_affected: allMembers?.map(member => ({
          user_id: member.user_id,
          role: member.role,
          email: member.profiles?.email,
          name: member.profiles?.full_name,
        })) || [],
        message: 'Team successfully deleted with all members and related data',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  catch (error) {
    console.error('Unexpected error in delete-team:', error)

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

import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

// Create aliases for consistency
const createServiceRoleClient = serverSupabaseServiceRole
const getCurrentUser = serverSupabaseUser

interface DeleteUserRequest {
  userId: string
  /** Remove from this team only; default: every team the caller administers and shares with the user. */
  teamId?: string
}

/** Long enough to mean "until invited again" (accept/invite lifts it). */
const BAN_DURATION = '876000h'

/**
 * Remove a member from the team and, when they are left in no team, block
 * their login. The account and profile are kept on purpose: rows the app
 * records as created/updated/approved by them keep pointing at a real person
 * (audit trail), and deleting the auth user would fail on those references.
 * Inviting them again lifts the block.
 */
export default defineEventHandler(async (event) => {
  // Validate user is authenticated
  const currentUser = await getCurrentUser(event)
  if (!currentUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    })
  }

  const body = await readBody<DeleteUserRequest>(event)
  const userId = body?.userId
  const teamId = body?.teamId

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing userId',
    })
  }

  if (userId === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot remove yourself from the team',
    })
  }

  try {
    const supabaseAdmin = createServiceRoleClient(event)

    // Verify the current user has permission to delete this user
    // (they must be admin/owner/super_admin in the same team)
    const { data: currentUserTeams, error: currentUserError } = await supabaseAdmin
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', currentUser.id)
      .in('role', ['admin', 'owner', 'super_admin'])

    if (currentUserError || !currentUserTeams?.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have permission to remove members',
      })
    }

    const { data: targetUserTeams, error: targetUserError } = await supabaseAdmin
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId)

    if (targetUserError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to find target user',
      })
    }

    // Check if users share at least one team
    const sharedTeams = currentUserTeams.filter(currentTeam =>
      targetUserTeams?.some(targetTeam => targetTeam.team_id === currentTeam.team_id)
      && (!teamId || currentTeam.team_id === teamId),
    )

    if (!sharedTeams.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only remove members of your own teams',
      })
    }

    const removeFrom = sharedTeams.map(t => t.team_id)

    // Owners can only be removed by a super admin
    const targetIsOwner = targetUserTeams?.some(team => removeFrom.includes(team.team_id) && team.role === 'owner')
    const currentIsSuperAdmin = currentUserTeams.some(team => team.role === 'super_admin')

    if (targetIsOwner && !currentIsSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can remove team owners',
      })
    }

    const { error: removeError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('user_id', userId)
      .in('team_id', removeFrom)

    if (removeError) {
      console.error('Failed to remove member:', removeError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to remove member: ${removeError.message}`,
      })
    }

    // Left in no team: block the login (the account itself is kept)
    const stillMember = targetUserTeams?.some(team => !removeFrom.includes(team.team_id))
    if (!stillMember) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION })
      if (banError) {
        console.error('Removed member but failed to block login:', banError)
        throw createError({
          statusCode: 500,
          statusMessage: `Removed from the team, but failed to block the login: ${banError.message}`,
        })
      }
    }

    return { success: true, deactivated: !stillMember }
  }
  catch (error: any) {
    console.error('Error in delete-user API:', error)

    // Re-throw createError instances
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error',
    })
  }
})

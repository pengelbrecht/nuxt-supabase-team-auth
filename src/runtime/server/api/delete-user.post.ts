import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

// Create aliases for consistency
const createServiceRoleClient = serverSupabaseServiceRole
const getCurrentUser = serverSupabaseUser

interface DeleteUserRequest {
  userId: string
}

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

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing userId',
    })
  }

  try {
    // Use service role client to delete user
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
        statusMessage: 'You do not have permission to delete users',
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
      targetUserTeams?.some(targetTeam => targetTeam.team_id === currentTeam.team_id),
    )

    if (!sharedTeams.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only delete users from your own teams',
      })
    }

    // Prevent deleting owners unless current user is super_admin
    const targetIsOwner = targetUserTeams?.some(team => team.role === 'owner')
    const currentIsSuperAdmin = currentUserTeams.some(team => team.role === 'super_admin')

    if (targetIsOwner && !currentIsSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only super admins can delete team owners',
      })
    }

    // Delete the user account (cascades to profiles and team_members)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to delete user: ${deleteError.message}`,
      })
    }

    return { success: true }
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

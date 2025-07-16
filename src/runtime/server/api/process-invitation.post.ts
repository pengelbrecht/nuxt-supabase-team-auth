import { defineEventHandler, readBody, createError } from 'h3'
import { createSessionFromMagicLink } from '../utils/magicLinkSession'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    console.log('=== PROCESS INVITATION API ===')

    const body = await readBody(event)
    const { access_token, refresh_token } = body

    if (!access_token || !refresh_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing access_token or refresh_token',
      })
    }

    // Get service role client for admin operations
    const adminClient = serverSupabaseServiceRole(event)

    // First, verify the tokens are valid by getting the user
    const { data: { user }, error: userError } = await adminClient.auth.getUser(access_token)

    if (userError || !user) {
      console.error('Invalid invitation token:', userError)
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired invitation token',
      })
    }

    console.log('Processing invitation for user:', user.email)

    // Extract invitation metadata
    const metadata = user.user_metadata
    const teamId = metadata?.team_id
    const teamName = metadata?.team_name
    const inviteRole = metadata?.role || 'member'

    if (!teamId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid invitation: missing team information',
      })
    }

    // Use magic link approach to create a clean session
    // This avoids SSR cookie conflicts that occur with direct setSession
    const { session, user: sessionUser } = await createSessionFromMagicLink(
      adminClient,
      user.email!,
      {
        // Preserve invitation metadata
        team_id: teamId,
        team_name: teamName,
        role: inviteRole,
        invited_by: metadata?.invited_by,
        invited_by_email: metadata?.invited_by_email,
        email_verified: true,
      },
    )

    // Get team info if not in metadata
    let finalTeamName = teamName
    if (!finalTeamName) {
      const { data: team } = await adminClient
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single()

      if (team) {
        finalTeamName = team.name
      }
    }

    // Check if user is already a member of this team
    const { data: membership } = await adminClient
      .from('team_members')
      .select('id')
      .eq('user_id', sessionUser.id)
      .eq('team_id', teamId)
      .maybeSingle()

    return {
      success: true,
      session,
      user: sessionUser,
      team: {
        id: teamId,
        name: finalTeamName,
      },
      isExistingMember: !!membership,
      needsPasswordSetup: !user.email_confirmed_at
        || (new Date(user.email_confirmed_at).getTime() - new Date(user.created_at).getTime() < 5 * 60 * 1000),
    }
  }
  catch (error: unknown) {
    console.error('Process invitation error:', error)
    const errorObj = error as any

    // If it's already a createError, just re-throw it
    if (errorObj.statusCode) {
      throw error
    }

    // Otherwise, wrap it
    throw createError({
      statusCode: 500,
      statusMessage: errorObj.message || 'Failed to process invitation',
    })
  }
})

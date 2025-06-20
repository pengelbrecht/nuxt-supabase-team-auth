import { createError } from 'h3'
import { createServiceRoleClient, getCurrentUser } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  console.log('Stop impersonation request received')

  try {
    // Get the current user session (should be the impersonated user)
    const user = await getCurrentUser(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Not authenticated',
      })
    }

    // Get the impersonation session ID from the request
    const { sessionId, originalAccessToken } = await readBody(event)

    if (!sessionId || !originalAccessToken) {
      throw createError({
        statusCode: 400,
        message: 'Session ID and original access token are required',
      })
    }

    // Get service role client
    const adminClient = createServiceRoleClient()

    // Verify the impersonation session exists and is active
    const { data: sessionData, error: sessionError } = await adminClient
      .from('impersonation_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('target_user_id', user.id)
      .is('ended_at', null)
      .single()

    if (sessionError || !sessionData) {
      throw createError({
        statusCode: 404,
        message: 'Active impersonation session not found',
      })
    }

    // Update the impersonation session to mark it as ended
    const { error: updateError } = await adminClient
      .from('impersonation_sessions')
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to update impersonation session:', updateError)
      // Continue anyway - better to restore the session than to fail
    }

    console.log('Impersonation session ended successfully')

    // Return success - the client will restore the original session
    return {
      success: true,
      message: 'Impersonation ended successfully',
    }
  }
  catch (error: unknown) {
    console.error('Stop impersonation error:', error)
    const errorObj = error as any

    if (errorObj.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: errorObj.message || 'Failed to stop impersonation',
    })
  }
})

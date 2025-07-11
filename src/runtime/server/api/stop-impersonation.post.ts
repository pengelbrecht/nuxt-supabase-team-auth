import { defineEventHandler, readBody, createError, getCookie, deleteCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

// Create aliases for consistency
const createServiceRoleClient = serverSupabaseServiceRole
const getCurrentUser = serverSupabaseUser

export default defineEventHandler(async (event) => {
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
    const { sessionId } = await readBody(event)

    if (!sessionId) {
      throw createError({
        statusCode: 400,
        message: 'Session ID is required',
      })
    }

    // Get service role client
    const adminClient = createServiceRoleClient(event)

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

    // Get the admin impersonation JWT from cookie using h3's getCookie
    const impersonationCookie = getCookie(event, 'admin-impersonation')

    if (!impersonationCookie) {
      throw createError({
        statusCode: 400,
        message: 'Admin impersonation cookie not found',
      })
    }

    // Verify and decode the JWT
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'fallback-secret-for-dev'

    let adminEmail: string
    try {
      const decoded = jwt.verify(impersonationCookie, jwtSecret) as any
      adminEmail = decoded.admin_email

      if (!adminEmail) {
        throw new Error('Admin email not found in JWT')
      }
    }
    catch (error) {
      console.error('Failed to verify impersonation JWT:', error)
      throw createError({
        statusCode: 400,
        message: 'Invalid impersonation session token',
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

    // Clean up the impersonation cookie using h3's deleteCookie
    deleteCookie(event, 'admin-impersonation', {
      path: '/',
    })

    // Generate a magic link for the admin to log back in
    const { data: magicLinkData, error: magicLinkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: adminEmail,
    })

    if (magicLinkError || !magicLinkData.properties?.hashed_token) {
      console.error('Failed to generate magic link for admin restoration:', magicLinkError)
      throw createError({
        statusCode: 500,
        message: 'Failed to generate admin session restoration link',
      })
    }

    // Immediately verify the OTP to create an admin session
    const { data: adminSessionData, error: verifyError } = await adminClient.auth.verifyOtp({
      token_hash: magicLinkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyError || !adminSessionData.session) {
      console.error('Failed to verify admin restoration OTP:', verifyError)
      throw createError({
        statusCode: 500,
        message: 'Failed to restore admin session',
      })
    }

    // Return the restored admin session
    return {
      success: true,
      message: 'Impersonation ended successfully',
      session: adminSessionData.session,
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

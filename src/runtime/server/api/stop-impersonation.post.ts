import { defineEventHandler, readBody, createError, getCookie, deleteCookie, getHeader } from 'h3'
import { jwtVerify } from 'jose'
import { createSessionFromMagicLink } from '../utils/magicLinkSession'
import { serverSupabaseServiceRole } from '#supabase/server'

// Create aliases for consistency
const createServiceRoleClient = serverSupabaseServiceRole

export default defineEventHandler(async (event) => {
  try {
    // Get the authorization header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader) {
      throw createError({
        statusCode: 401,
        message: 'Missing authorization header',
      })
    }

    // Extract the token from the Bearer header
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw createError({
        statusCode: 401,
        message: 'Invalid authorization header format',
      })
    }

    // Get service role client for admin operations
    const adminClient = createServiceRoleClient(event)

    // Get user from the token (should be the impersonated user)
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) {
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token',
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
    const jwtSecret = process.env.SUPABASE_JWT_SECRET
    if (!jwtSecret) {
      throw createError({
        statusCode: 500,
        message: 'SUPABASE_JWT_SECRET environment variable is required for impersonation functionality',
      })
    }

    let adminEmail: string
    try {
      const { payload } = await jwtVerify(impersonationCookie, new TextEncoder().encode(jwtSecret))
      adminEmail = payload.admin_email as string

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

    // Use shared utility to restore admin session via magic link
    const { session: adminSession } = await createSessionFromMagicLink(
      adminClient,
      adminEmail,
    )

    // Return the restored admin session
    return {
      success: true,
      message: 'Impersonation ended successfully',
      session: adminSession,
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

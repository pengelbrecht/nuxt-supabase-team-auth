import { defineEventHandler, readBody, createError, setCookie, getHeader } from 'h3'
import { SignJWT } from 'jose'
import { createSessionFromMagicLink } from '../utils/magicLinkSession'
import { serverSupabaseServiceRole } from '#supabase/server'

// Create aliases for consistency
const createServiceRoleClient = serverSupabaseServiceRole

export default defineEventHandler(async (event) => {
  try {
    console.log('=== IMPERSONATE API DEBUG ===')

    // Get the authorization header
    const authHeader = getHeader(event, 'authorization')
    console.log('Auth header present:', !!authHeader)
    console.log('Auth header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'null')

    if (!authHeader) {
      console.log('ERROR: Missing authorization header')
      throw createError({
        statusCode: 401,
        message: 'Missing authorization header',
      })
    }

    // Extract the token from the Bearer header
    const token = authHeader.replace('Bearer ', '')
    console.log('Token extracted:', token ? token.substring(0, 20) + '...' : 'null')

    if (!token) {
      console.log('ERROR: Invalid authorization header format')
      throw createError({
        statusCode: 401,
        message: 'Invalid authorization header format',
      })
    }

    // Get service role client for admin operations
    const adminClient = createServiceRoleClient(event)

    // Get user from the token
    console.log('Attempting to get user from token...')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    console.log('User result:', user ? `User ID: ${user.id}` : 'No user')
    console.log('User error:', userError)

    if (userError || !user) {
      console.log('ERROR: Invalid or expired token')
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token',
      })
    }

    // Verify user is a super admin
    const { data: memberData, error: memberError } = await adminClient
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      throw createError({
        statusCode: 403,
        message: 'Access denied',
      })
    }

    if (memberData.role !== 'super_admin') {
      throw createError({
        statusCode: 403,
        message: 'Only super admins can impersonate users',
      })
    }

    // Get request body
    const body = await readBody<{ targetUserId?: string, reason?: string }>(event)
    const { targetUserId, reason } = body || {}

    if (!targetUserId) {
      throw createError({
        statusCode: 400,
        message: 'Target user ID is required',
      })
    }

    if (!reason || reason.trim().length < 10) {
      throw createError({
        statusCode: 400,
        message: 'A valid reason (at least 10 characters) is required for impersonation',
      })
    }

    // Verify target user exists and get their team info
    const { data: targetMember, error: targetError } = await adminClient
      .from('team_members')
      .select(`
        user_id,
        role,
        teams (
          id,
          name
        ),
        profiles!inner (
          id,
          email,
          full_name
        )
      `)
      .eq('user_id', targetUserId)
      .single()

    if (targetError || !targetMember) {
      console.error('Target user query error:', targetError)
      throw createError({
        statusCode: 404,
        message: 'Target user not found',
      })
    }

    // Prevent impersonating other super admins
    if (targetMember.role === 'super_admin') {
      throw createError({
        statusCode: 403,
        message: 'Cannot impersonate other super admin users',
      })
    }

    // Create impersonation session log
    const insertData = {
      admin_user_id: user.id,
      target_user_id: targetUserId,
      reason: reason.trim(),
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    }

    const { data: sessionLog, error: logError } = await adminClient
      .from('impersonation_sessions')
      .insert(insertData)
      .select()
      .single()

    if (logError || !sessionLog) {
      console.error('Failed to create impersonation log:', logError)
      throw createError({
        statusCode: 500,
        message: 'Failed to create impersonation session',
      })
    }

    // Get the target user's email from profiles
    const targetEmail = targetMember.profiles.email
    if (!targetEmail) {
      throw createError({
        statusCode: 400,
        message: 'Target user does not have a valid email address',
      })
    }

    // Creating session for target user

    // Use admin API to create a session for the target user
    // This approach uses getUserById to ensure we have the full auth user data
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetUserId)

    if (authUserError || !authUserData.user) {
      console.error('Failed to get auth user:', authUserError)
      throw createError({
        statusCode: 500,
        message: 'Failed to retrieve target user authentication data',
      })
    }

    // Use shared utility to create session via magic link
    const { session: targetSession } = await createSessionFromMagicLink(
      adminClient,
      targetEmail,
      {
        impersonation_session_id: sessionLog.id,
        impersonated_by: user.id,
        impersonation_expires_at: sessionLog.expires_at,
      },
    )

    // Store admin email in JWT-signed cookie for session termination
    // This replaces the complex refresh token storage approach
    const adminEmail = user.email
    if (!adminEmail) {
      throw createError({
        statusCode: 400,
        message: 'Admin user does not have a valid email address',
      })
    }

    // Create a simple JWT with admin email for impersonation termination
    const jwtSecret = process.env.SUPABASE_JWT_SECRET
    if (!jwtSecret) {
      throw createError({
        statusCode: 500,
        message: 'SUPABASE_JWT_SECRET environment variable is required for impersonation functionality',
      })
    }

    const impersonationToken = await new SignJWT({
      admin_email: adminEmail,
      admin_id: user.id,
      session_id: sessionLog.id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(jwtSecret))

    // Store the JWT in an httpOnly cookie using h3's setCookie
    setCookie(event, 'admin-impersonation', impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60, // 30 minutes, same as impersonation session
      path: '/',
    })

    // Return the impersonation data (without sensitive tokens)
    return {
      success: true,
      impersonation: {
        session_id: sessionLog.id,
        target_user: {
          id: targetMember.user_id,
          email: targetEmail,
          full_name: targetMember.profiles.full_name,
          role: targetMember.role,
          team: targetMember.teams,
        },
        expires_at: sessionLog.expires_at,
      },
      // New session for the impersonated user
      session: targetSession,
      // Only return admin user ID (tokens stored securely server-side)
      originalUser: {
        id: user.id,
        email: user.email,
      },
    }
  }
  catch (error: unknown) {
    console.error('Impersonation error:', error)
    const errorObj = error as any

    // If it's already a createError, just re-throw it
    if (errorObj.statusCode) {
      throw error
    }

    // Otherwise, wrap it
    throw createError({
      statusCode: 500,
      message: errorObj.message || 'Internal server error during impersonation',
    })
  }
})

import type { SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'

/**
 * Common utility for creating sessions using magic links
 * Used by both impersonation and invitation flows
 */
export async function createSessionFromMagicLink(
  adminClient: SupabaseClient,
  email: string,
  metadata?: Record<string, any>,
) {
  try {
    console.log(`[MagicLinkSession] Generating magic link for ${email}`)

    // Generate a magic link for the user
    const { data: magicLinkData, error: magicLinkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: metadata ? { data: metadata } : undefined,
    })

    if (magicLinkError || !magicLinkData.properties?.hashed_token) {
      console.error('[MagicLinkSession] Failed to generate magic link:', magicLinkError)
      throw createError({
        statusCode: 500,
        message: 'Failed to generate authentication link',
      })
    }

    console.log('[MagicLinkSession] Magic link generated, verifying OTP...')

    // Immediately verify the OTP to create a session
    const { data: sessionData, error: verifyError } = await adminClient.auth.verifyOtp({
      token_hash: magicLinkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyError || !sessionData.session) {
      console.error('[MagicLinkSession] Failed to verify OTP:', verifyError)
      throw createError({
        statusCode: 500,
        message: 'Failed to create authentication session',
      })
    }

    console.log('[MagicLinkSession] Session created successfully')

    return {
      session: sessionData.session,
      user: sessionData.user,
    }
  }
  catch (error) {
    console.error('[MagicLinkSession] Unexpected error:', error)
    throw error
  }
}

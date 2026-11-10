import { defineEventHandler, readBody, createError, getRequestURL } from 'h3'
import { $fetch } from 'ofetch'
import {
  buildInviteRedirect,
  findResendableInvite,
  normalizeResendInput,
  RESEND_INVITE_RESPONSE,
  type InvitedUserCandidate,
} from '../../utils/resendInvite'
import { useRuntimeConfig } from '#imports'

/**
 * POST /api/auth/resend-invite  { email, team_id }
 *
 * Public: called from the /auth/confirm page after an invite link expired. Always answers with the
 * same generic response so it can't be used to probe which emails are invited or registered.
 */
export default defineEventHandler(async (event) => {
  const input = normalizeResendInput(await readBody(event).catch(() => null))
  if (!input) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email and team_id are required' })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabase?.url
  const serviceKey = config.supabaseServiceKey
  if (!supabaseUrl || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing Supabase configuration' })
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  try {
    // GoTrue's admin `filter` is a substring match on email; findResendableInvite narrows to exact.
    const { users } = await $fetch<{ users: Array<InvitedUserCandidate & { id: string }> }>(
      `${supabaseUrl}/auth/v1/admin/users`,
      { headers, query: { filter: input.email, per_page: 50 } },
    )

    const invite = findResendableInvite(users || [], input.email, input.teamId)
    if (!invite) {
      console.info('[resend-invite] no pending invitation matched; nothing sent')
      return RESEND_INVITE_RESPONSE
    }

    // Re-inviting an existing unconfirmed user makes GoTrue issue a fresh token and re-send the
    // invite email; the old link stops working. The redirect must be on the project's allowlist.
    const redirectTo = buildInviteRedirect(getRequestURL(event, { xForwardedProto: true, xForwardedHost: true }).origin, input.teamId)
    await $fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers,
      query: { redirect_to: redirectTo },
      body: { email: input.email, data: invite.user_metadata || {} },
    })
    console.info('[resend-invite] re-sent invitation', { user_id: invite.id, team_id: input.teamId })
  }
  catch (error: any) {
    // Log, but keep the response generic (GoTrue rate limits land here too).
    console.error('[resend-invite] failed:', error?.status, error?.data?.msg || error?.message)
  }

  return RESEND_INVITE_RESPONSE
})

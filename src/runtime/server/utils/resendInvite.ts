/**
 * Self-serve invitation resend, used by the /auth/confirm page when an invite link has expired.
 *
 * The endpoint is unauthenticated (the invitee has no session yet), so it must not become an
 * open "invite anyone" or "who has an account" oracle:
 * - it only re-sends to an existing, still-unconfirmed invited user,
 * - the caller must know the team the invite was for (team_id is in the expired link),
 * - the response is identical whether or not anything was sent.
 */

export interface InvitedUserCandidate {
  email?: string | null
  invited_at?: string | null
  email_confirmed_at?: string | null
  user_metadata?: Record<string, unknown> | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeResendInput(body: unknown): { email: string, teamId: string } | null {
  if (!body || typeof body !== 'object') return null
  const { email, team_id } = body as Record<string, unknown>
  if (typeof email !== 'string' || typeof team_id !== 'string') return null
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail) || !UUID_RE.test(team_id)) return null
  return { email: normalizedEmail, teamId: team_id }
}

/**
 * Pick the user matching `email` exactly from a GoTrue admin `filter` result (which is an ILIKE
 * substring match) and return it only if it is a pending invitation to `teamId`.
 */
export function findResendableInvite<T extends InvitedUserCandidate>(
  users: T[],
  email: string,
  teamId: string,
): T | null {
  const user = users.find(u => (u.email || '').toLowerCase() === email)
  if (!user) return null
  if (!user.invited_at || user.email_confirmed_at) return null
  if (user.user_metadata?.team_id !== teamId) return null
  return user
}

export function buildInviteRedirect(origin: string, teamId: string): string {
  return `${origin}/auth/confirm?type=invite&team_id=${encodeURIComponent(teamId)}`
}

export const RESEND_INVITE_RESPONSE = {
  success: true,
  message: 'If there is a pending invitation for this email, a new link has been sent.',
} as const

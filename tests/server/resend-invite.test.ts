import { describe, it, expect } from 'vitest'
import {
  buildInviteRedirect,
  findResendableInvite,
  normalizeResendInput,
} from '../../src/runtime/server/utils/resendInvite'

const TEAM = '89766534-2339-4f57-9abf-8ae01bc329b7'
const OTHER_TEAM = '11111111-2222-3333-4444-555555555555'

const pending = {
  email: 'aka@example.com',
  invited_at: '2026-11-09T14:18:11Z',
  email_confirmed_at: null,
  user_metadata: { team_id: TEAM, role: 'member' },
}

describe('normalizeResendInput', () => {
  it('accepts a valid email and uuid team_id, normalising the email', () => {
    expect(normalizeResendInput({ email: '  AKA@Example.com ', team_id: TEAM }))
      .toEqual({ email: 'aka@example.com', teamId: TEAM })
  })

  it.each([
    null,
    'nope',
    {},
    { email: 'aka@example.com' },
    { team_id: TEAM },
    { email: 'not-an-email', team_id: TEAM },
    { email: 'aka@example.com', team_id: 'not-a-uuid' },
    { email: 42, team_id: TEAM },
  ])('rejects %j', (body) => {
    expect(normalizeResendInput(body)).toBeNull()
  })
})

describe('findResendableInvite', () => {
  it('returns the pending invite for the exact email and team', () => {
    expect(findResendableInvite([pending], 'aka@example.com', TEAM)).toBe(pending)
  })

  it('matches email case-insensitively but exactly (filter is a substring match)', () => {
    const lookalike = { ...pending, email: 'xaka@example.com' }
    const upper = { ...pending, email: 'AKA@example.com' }
    expect(findResendableInvite([lookalike], 'aka@example.com', TEAM)).toBeNull()
    expect(findResendableInvite([lookalike, upper], 'aka@example.com', TEAM)).toBe(upper)
  })

  it('refuses confirmed users (invite already accepted)', () => {
    const confirmed = { ...pending, email_confirmed_at: '2026-11-09T15:00:00Z' }
    expect(findResendableInvite([confirmed], 'aka@example.com', TEAM)).toBeNull()
  })

  it('refuses users that were never invited (regular signups)', () => {
    const signup = { ...pending, invited_at: null }
    expect(findResendableInvite([signup], 'aka@example.com', TEAM)).toBeNull()
  })

  it('refuses when the invite is for a different team', () => {
    expect(findResendableInvite([pending], 'aka@example.com', OTHER_TEAM)).toBeNull()
  })

  it('refuses when there is no team in the metadata', () => {
    const noTeam = { ...pending, user_metadata: {} }
    expect(findResendableInvite([noTeam], 'aka@example.com', TEAM)).toBeNull()
  })

  it('returns null for no users', () => {
    expect(findResendableInvite([], 'aka@example.com', TEAM)).toBeNull()
  })
})

describe('buildInviteRedirect', () => {
  it('points at the confirm page with type and team', () => {
    expect(buildInviteRedirect('https://chefswiz.com', TEAM))
      .toBe(`https://chefswiz.com/auth/confirm?type=invite&team_id=${TEAM}`)
  })
})

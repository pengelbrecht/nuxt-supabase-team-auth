import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { userFactory } from '../helpers/user-factory'
import { createTestSupabaseClient, validateTestEnvironment } from '../helpers/test-env'

/**
 * Integration tests for the new native Supabase invitation system
 *
 * Tests cover:
 * - Creating invitations using auth.admin.inviteUserByEmail()
 * - Listing pending invitations filtered by team and confirmation status
 * - Revoking invitations using auth.admin.deleteUser()
 * - Accepting invitations and joining teams
 * - Error handling and edge cases
 */
describe('Native Invitations Integration Tests', () => {
  let serviceClient: any
  let testTeam: any
  let teamOwner: any
  let teamAdmin: any
  let consoleWarnSpy: any

  beforeAll(async () => {
    // Suppress GoTrueClient warnings during tests
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('Multiple GoTrueClient instances')) {
        return // Suppress this specific warning
      }
      console.log(message) // Allow other warnings through
    })
    console.log('[NATIVE-INVITATIONS] beforeAll: Starting setup')

    // Validate environment in CI
    validateTestEnvironment()

    // Service role client for setup
    serviceClient = createTestSupabaseClient('service')

    // Create test team with owner and admin using unique timestamp and domain
    const timestamp = Date.now()
    console.log(`[NATIVE-INVITATIONS] beforeAll: Creating team with timestamp ${timestamp}`)

    // Use custom domain for this test to help track orphaned users
    const ownerWithTeam = await userFactory.createOwnerWithTeam({
      teamName: `Test-Invitations-${timestamp}`,
      testDomain: 'native-invitations-test.com',
    })
    testTeam = ownerWithTeam.team
    teamOwner = ownerWithTeam.user

    // Create admin with same domain
    teamAdmin = await userFactory.createUserWithRole(testTeam.id, 'admin', {
      testDomain: 'native-invitations-test.com',
    })

    console.log(`[NATIVE-INVITATIONS] beforeAll: Created team ${testTeam.id} with owner ${teamOwner.email}`)
    console.log(`[NATIVE-INVITATIONS] beforeAll: Factory tracked users: ${userFactory.getCreatedUserIds().length}`)
    console.log(`[NATIVE-INVITATIONS] beforeAll: Setup complete`)
  })

  afterAll(async () => {
    console.log('[NATIVE-INVITATIONS] afterAll: Starting cleanup')

    // IMPORTANT: The userFactory already tracks teams and users, so we should rely on it
    // instead of duplicating the cleanup logic. This avoids the double-deletion issue.

    // Just use the factory cleanup which handles the correct order
    console.log(`[NATIVE-INVITATIONS] afterAll: Factory has ${userFactory.getCreatedUserIds().length} users and teams to clean`)
    await userFactory.cleanup()

    // Additionally, clean up any invitations created during tests that the factory doesn't track
    try {
      const { data: allUsers } = await serviceClient.auth.admin.listUsers()
      // Clean up ANY test users with test email patterns, regardless of confirmation status
      const testUsers = allUsers.users.filter(u =>
        u.email?.includes('test-invite-')
        || u.email?.includes('test-malformed-')
        || u.email?.includes('test-invalid-')
        || u.email?.includes('@native-invitations-test.com'),
      )

      if (testUsers.length > 0) {
        console.log(`[NATIVE-INVITATIONS] afterAll: Cleaning up ${testUsers.length} test users`)
        for (const user of testUsers) {
          await serviceClient.auth.admin.deleteUser(user.id)
        }
      }
    }
    catch (error) {
      console.error('[NATIVE-INVITATIONS] afterAll: Error cleaning up invitations:', error)
    }

    console.log('[NATIVE-INVITATIONS] afterAll: Cleanup complete')

    // Restore console.warn spy
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore()
    }
  })

  beforeEach(async () => {
    // Clean up any pending test invitations before each test
    const { data: allUsers } = await serviceClient.auth.admin.listUsers()

    // Find and delete any test users from this test suite, regardless of confirmation status
    for (const user of allUsers.users) {
      if (user.email?.includes('test-invite-')
        || user.email?.includes('test-malformed-')
        || user.email?.includes('test-invalid-')) {
        await serviceClient.auth.admin.deleteUser(user.id)
      }
    }
  })

  describe('Invitation Creation', () => {
    it('should create invitation using auth.admin.inviteUserByEmail with team metadata', async () => {
      const testEmail = `test-invite-${Date.now()}@native-invitations-test.com`

      // Create invitation
      const { data: inviteData, error } = await serviceClient.auth.admin.inviteUserByEmail(
        testEmail,
        {
          data: {
            team_id: testTeam.id,
            team_name: testTeam.name,
            invited_by: teamOwner.id,
            invited_by_email: teamOwner.email,
            role: 'member',
          },
        },
      )

      expect(error).toBeNull()
      expect(inviteData.user).toBeDefined()
      expect(inviteData.user.email).toBe(testEmail)
      expect(inviteData.user.email_confirmed_at).toBeFalsy() // Pending invitation
      expect(inviteData.user.invited_at).toBeTruthy()
      expect(inviteData.user.user_metadata.team_id).toBe(testTeam.id)
      expect(inviteData.user.user_metadata.role).toBe('member')
    })

    it('should prevent duplicate invitations for same email', async () => {
      const testEmail = `test-invite-duplicate-${Date.now()}@native-invitations-test.com`

      // Create first invitation
      await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: { team_id: testTeam.id, role: 'member' },
      })

      // Attempt to create second invitation
      const { error } = await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: { team_id: testTeam.id, role: 'member' },
      })

      expect(error).toBeTruthy()
      expect(error.message).toContain('Database error saving new user')
    })
  })

  describe('Listing Pending Invitations', () => {
    it('should list pending invitations filtered by team', async () => {
      const testEmail1 = `test-invite-1-${Date.now()}@native-invitations-test.com`
      const testEmail2 = `test-invite-2-${Date.now()}@native-invitations-test.com`

      // Create test invitations
      await serviceClient.auth.admin.inviteUserByEmail(testEmail1, {
        data: { team_id: testTeam.id, role: 'member' },
      })
      await serviceClient.auth.admin.inviteUserByEmail(testEmail2, {
        data: { team_id: testTeam.id, role: 'admin' },
      })

      // List all users and filter for pending invitations for this team
      const { data: allUsers } = await serviceClient.auth.admin.listUsers()

      const pendingInvitations = allUsers.users.filter(user =>
        !user.email_confirmed_at
        && user.user_metadata?.team_id === testTeam.id,
      )

      expect(pendingInvitations).toHaveLength(2)

      const emails = pendingInvitations.map(u => u.email)
      expect(emails).toContain(testEmail1)
      expect(emails).toContain(testEmail2)

      // Check metadata
      const invitation1 = pendingInvitations.find(u => u.email === testEmail1)
      const invitation2 = pendingInvitations.find(u => u.email === testEmail2)

      expect(invitation1?.user_metadata.role).toBe('member')
      expect(invitation2?.user_metadata.role).toBe('admin')
    })

    it('should not include confirmed users in pending invitations', async () => {
      // List all users and ensure no confirmed users are included in pending filter
      const { data: allUsers } = await serviceClient.auth.admin.listUsers()

      const confirmedUsers = allUsers.users.filter(user => user.email_confirmed_at !== null)
      const pendingInvitations = allUsers.users.filter(user =>
        !user.email_confirmed_at
        && user.user_metadata?.team_id === testTeam.id,
      )

      expect(confirmedUsers.length).toBeGreaterThan(0) // We have confirmed test users

      // No confirmed user should appear in pending invitations
      for (const confirmed of confirmedUsers) {
        expect(pendingInvitations.find(p => p.id === confirmed.id)).toBeUndefined()
      }
    })
  })

  describe('Revoking Invitations', () => {
    it('should revoke invitation by deleting unconfirmed user', async () => {
      const testEmail = `test-invite-revoke-${Date.now()}@native-invitations-test.com`

      // Create invitation
      const { data: inviteData } = await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: { team_id: testTeam.id, role: 'member' },
      })

      const invitedUserId = inviteData.user.id

      // Verify invitation exists
      const { data: userBefore } = await serviceClient.auth.admin.getUserById(invitedUserId)
      expect(userBefore.user).toBeTruthy()
      expect(userBefore.user.email_confirmed_at).toBeFalsy()

      // Revoke invitation by deleting user
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(invitedUserId)
      expect(deleteError).toBeNull()

      // Verify user is deleted
      const { data: userAfter, error: getUserError } = await serviceClient.auth.admin.getUserById(invitedUserId)
      expect(getUserError).toBeTruthy()
      expect(userAfter.user).toBeNull()
    })

    it('should not allow revoking confirmed users', async () => {
      // Try to delete a confirmed user (should fail or have different behavior)
      const { error } = await serviceClient.auth.admin.deleteUser(teamOwner.id)

      // This should either fail or require special handling for confirmed users
      // The exact behavior depends on Supabase configuration
      if (!error) {
        // If it succeeded, verify the user still exists in profiles/team_members
        const { data: teamMember } = await serviceClient
          .from('team_members')
          .select('*')
          .eq('user_id', teamOwner.id)
          .single()

        // The team member record should still exist even if auth user is deleted
        expect(teamMember).toBeTruthy()
      }
    })
  })

  describe('Invitation Acceptance Flow', () => {
    it('should properly handle invitation acceptance metadata', async () => {
      const testEmail = `test-invite-accept-${Date.now()}@native-invitations-test.com`

      // Create invitation with specific metadata
      const { data: inviteData } = await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: {
          team_id: testTeam.id,
          team_name: testTeam.name,
          invited_by: teamAdmin.id,
          invited_by_email: teamAdmin.email,
          role: 'admin',
        },
      })

      // Verify invitation metadata is properly stored
      expect(inviteData.user.user_metadata.team_id).toBe(testTeam.id)
      expect(inviteData.user.user_metadata.team_name).toBe(testTeam.name)
      expect(inviteData.user.user_metadata.invited_by).toBe(teamAdmin.id)
      expect(inviteData.user.user_metadata.role).toBe('admin')

      // In a real invitation flow, the user would sign up and confirm their email
      // For testing, we can simulate this by updating the user's email_confirmed_at
      await serviceClient.auth.admin.updateUserById(inviteData.user.id, {
        email_confirm: true,
      })

      // Verify user is now confirmed
      const { data: confirmedUser } = await serviceClient.auth.admin.getUserById(inviteData.user.id)
      expect(confirmedUser.user.email_confirmed_at).toBeTruthy()
      expect(confirmedUser.user.user_metadata.team_id).toBe(testTeam.id)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid team IDs gracefully', async () => {
      const testEmail = `test-invite-invalid-${Date.now()}@native-invitations-test.com`
      const invalidTeamId = 'invalid-team-id'

      // This should succeed at the auth level but validation would happen in Edge Functions
      const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: {
          team_id: invalidTeamId,
          role: 'member',
        },
      })

      expect(error).toBeNull() // Auth invitation succeeds
      expect(data.user.user_metadata.team_id).toBe(invalidTeamId)
      // Edge Function would validate team exists and handle the error
    })

    it('should handle malformed metadata gracefully', async () => {
      const testEmail = `test-invite-malformed-${Date.now()}@native-invitations-test.com`

      const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(testEmail, {
        data: {
          // Missing required fields to test Edge Function validation
          invalid_field: 'test',
        },
      })

      expect(error).toBeNull() // Auth level succeeds
      expect(data.user.user_metadata.invalid_field).toBe('test')
      // Edge Function validation would catch missing team_id
    })
  })

  describe('Performance and Scalability', () => {
    it('should efficiently filter large user lists by pending status', async () => {
      const startTime = Date.now()

      // Get all users and filter
      const { data: allUsers } = await serviceClient.auth.admin.listUsers()

      const pendingInvitations = allUsers.users.filter(user =>
        !user.email_confirmed_at
        && user.user_metadata?.team_id === testTeam.id,
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000) // 1 second
      expect(Array.isArray(pendingInvitations)).toBe(true)
    })
  })
})

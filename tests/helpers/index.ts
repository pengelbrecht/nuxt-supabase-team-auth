/**
 * Test Helpers Index
 *
 * Centralized exports for all testing utilities and helpers
 * Import from this file to access all test functionality
 */

// Import types
import type { User, Profile, Team } from '../../src/runtime/types'

// Test-specific user interface with additional test data
interface TestUser extends User {
  password?: string
  profile?: Profile
  teamId?: string
}

interface TestTeam extends Team {
  owner?: TestUser
}

interface TestInvitation {
  id: string
  email: string
  role: string
  status: string
  team_id: string
}

// Database utilities
export * from './database'
export { testDb } from './database'

// User factory
export * from './user-factory'
export { userFactory } from './user-factory'

// Team factory
export * from './team-factory'
export { teamFactory } from './team-factory'

// Database assertions
export * from './assertions'
export { dbAssertions, expectDatabaseState } from './assertions'

// Invitation and role helpers
export * from './invitation-helpers'
export { invitationHelpers, roleHelpers } from './invitation-helpers'

/**
 * Quick access object for all test utilities
 *
 * Usage:
 * ```typescript
 * import { testHelpers } from '@/tests/helpers'
 *
 * // Create test data
 * const user = await testHelpers.users.createUser()
 * const team = await testHelpers.teams.createTeamWithMembers({})
 *
 * // Assert database state
 * await testHelpers.assertions.assertUserExists(user.id)
 *
 * // Clean up
 * await testHelpers.database.resetDatabase()
 * ```
 */
export const testHelpers = {
  database: testDb,
  users: userFactory,
  teams: teamFactory,
  assertions: dbAssertions,
  invitations: invitationHelpers,
  roles: roleHelpers,
}

/**
 * Test environment setup utilities
 */
export const TestEnvironment = {
  /**
   * Set up a clean test environment
   */
  async setup(): Promise<void> {
    console.log('🧪 Setting up test environment...')
    await testDb.resetDatabase()
    console.log('✅ Test environment ready')
  },

  /**
   * Clean up test environment
   */
  async teardown(): Promise<void> {
    console.log('🧹 Cleaning up test environment...')
    await testDb.cleanupTestData()
    await userFactory.cleanup()
    await teamFactory.cleanup()
    console.log('✅ Test environment cleaned')
  },

  /**
   * Reset to clean state between tests
   */
  async reset(): Promise<void> {
    await testDb.resetDatabase()
  },

  /**
   * Get environment statistics
   */
  async getStats() {
    return await testDb.getStats()
  },
}

/**
 * Test data builder for complex scenarios
 */
export const TestDataBuilder = {
  /**
   * Create a complete test scenario with users and teams
   */
  async createCompleteScenario(): Promise<TestScenario> {
    // Create users with different roles
    const superAdmin = await userFactory.createSuperAdmin()
    const ownerWithTeam = await userFactory.createOwnerWithTeam()

    // Create additional team members
    const admin = await userFactory.createUserWithRole(ownerWithTeam.team.id, 'admin')
    const member1 = await userFactory.createUserWithRole(ownerWithTeam.team.id, 'member')
    const member2 = await userFactory.createUserWithRole(ownerWithTeam.team.id, 'member')

    // Create standalone user (not in any team)
    const standaloneUser = await userFactory.createUser({ emailPrefix: 'standalone' })

    // Create some invitations
    const invitations = await invitationHelpers.createBatchInvitations(
      ownerWithTeam.team.id,
      ownerWithTeam.user.id,
      [
        { email: 'invite1@example.com', role: 'member' },
        { email: 'invite2@example.com', role: 'admin' },
        { email: 'expired@example.com', role: 'member', expiresInHours: -24 },
      ],
    )

    return {
      superAdmin,
      team: {
        ...ownerWithTeam.team,
        owner: ownerWithTeam.user,
        admin,
        members: [member1, member2],
      },
      standaloneUser,
      invitations,
    }
  },

  /**
   * Create a multi-team scenario for testing cross-team operations
   */
  async createMultiTeamScenario(): Promise<MultiTeamScenario> {
    const teams = await teamFactory.createMultipleTeams(3, {
      adminCount: 1,
      memberCount: 2,
    })

    // Create a user who is in multiple teams
    const multiTeamUser = await userFactory.createUser({ emailPrefix: 'multi-team' })

    // Add to multiple teams with different roles
    await teamFactory.addMember(teams[0].team.id, multiTeamUser.id, 'admin')
    await teamFactory.addMember(teams[1].team.id, multiTeamUser.id, 'member')

    return {
      teams,
      multiTeamUser,
    }
  },
}

// Type definitions for test scenarios
export interface TestScenario {
  superAdmin: TestUser
  team: {
    id: string
    name: string
    owner: TestUser
    admin: TestUser
    members: TestUser[]
  }
  standaloneUser: TestUser
  invitations: TestInvitation[]
}

export interface MultiTeamScenario {
  teams: any[]
  multiTeamUser: any
}

/**
 * Test assertion helpers with better error messages
 */
export function createTestAssertions() {
  return {
    async expectUserToExist(userId: string, context = '') {
      const exists = await dbAssertions.assertUserExists(userId)
      if (!exists) {
        throw new Error(`Expected user ${userId} to exist${context ? ` (${context})` : ''}`)
      }
    },

    async expectUserToNotExist(userId: string, context = '') {
      const exists = await dbAssertions.assertUserExists(userId)
      if (exists) {
        throw new Error(`Expected user ${userId} to not exist${context ? ` (${context})` : ''}`)
      }
    },

    async expectTeamToHaveMembers(teamId: string, expectedCount: number, context = '') {
      const hasCorrectCount = await dbAssertions.assertTeamMemberCount(teamId, expectedCount)
      if (!hasCorrectCount) {
        throw new Error(`Expected team ${teamId} to have ${expectedCount} members${context ? ` (${context})` : ''}`)
      }
    },

    async expectUserToHaveRole(userId: string, teamId: string, expectedRole: any, context = '') {
      const hasRole = await dbAssertions.assertUserTeamRole(userId, teamId, expectedRole)
      if (!hasRole) {
        throw new Error(`Expected user ${userId} to have role ${expectedRole} in team ${teamId}${context ? ` (${context})` : ''}`)
      }
    },
  }
}

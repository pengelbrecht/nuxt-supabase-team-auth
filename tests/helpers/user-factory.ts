import type { SupabaseClient } from '@supabase/supabase-js'
import type { TestUser, TeamRole } from './database'
import { createTestSupabaseClient } from './test-env'

/**
 * Factory for creating test users with various configurations
 */
export class TestUserFactory {
  private supabase: SupabaseClient
  private createdUsers: string[] = []
  private createdTeams: string[] = []
  private testTeamId: string | null = null

  constructor() {
    this.supabase = createTestSupabaseClient('service')
  }

  /**
   * Create a user with default settings
   */
  async createUser(overrides: Partial<UserConfig> = {}): Promise<TestUser> {
    const config = {
      emailPrefix: 'test-user',
      password: 'TestPassword123!',
      emailConfirmed: true,
      metadata: {},
      testDomain: 'example.com',
      ...overrides,
    }

    const timestamp = Date.now()
    const email = `${config.emailPrefix}-${timestamp}@${config.testDomain}`

    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password: config.password,
      email_confirm: config.emailConfirmed,
      user_metadata: config.metadata,
    })

    if (error || !data.user) {
      throw new Error(`Failed to create user: ${error?.message}`)
    }

    // Track created user for cleanup
    this.createdUsers.push(data.user.id)

    return {
      id: data.user.id,
      email: data.user.email!,
      password: config.password,
    }
  }

  /**
   * Create a user with specific role assignment to a team
   */
  async createUserWithRole(teamId: string, role: TeamRole, overrides: Partial<UserConfig> = {}): Promise<TestUser> {
    const user = await this.createUser({
      emailPrefix: `${role}-user`,
      ...overrides,
    })

    // Add user to team with specified role
    const { error } = await this.supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: user.id,
        role,
      })

    if (error) {
      throw new Error(`Failed to assign role ${role} to user: ${error.message}`)
    }

    return user
  }

  /**
   * Create a team owner with their own team
   */
  async createOwnerWithTeam(overrides: Partial<UserConfig & TeamConfig> = {}): Promise<UserWithTeam> {
    const user = await this.createUser({
      emailPrefix: 'owner',
      ...overrides,
    })

    const teamName = overrides.teamName || `${user.email.split('@')[0]}'s Team`

    const { data: team, error: teamError } = await this.supabase
      .from('teams')
      .insert({
        name: teamName,
      })
      .select()
      .single()

    if (teamError || !team) {
      throw new Error(`Failed to create team: ${teamError?.message}`)
    }

    // Track created team for cleanup
    this.createdTeams.push(team.id)

    // Add user as owner
    const { error: memberError } = await this.supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      throw new Error(`Failed to make user team owner: ${memberError.message}`)
    }

    return {
      user,
      team: {
        id: team.id,
        name: team.name,
        created_by: team.created_by,
        created_at: team.created_at,
      },
    }
  }

  /**
   * Create a super admin user
   */
  async createSuperAdmin(overrides: Partial<UserConfig> = {}): Promise<TestUser> {
    return this.createUser({
      emailPrefix: 'super-admin',
      metadata: { role: 'super_admin' },
      ...overrides,
    })
  }

  /**
   * Create multiple users with different roles for a team
   */
  async createTeamWithUsers(teamName?: string): Promise<TeamWithUsers> {
    // Create owner with team
    const ownerWithTeam = await this.createOwnerWithTeam({
      teamName: teamName || `Test Team ${Date.now()}`,
    })

    // Create additional team members
    const admin = await this.createUserWithRole(ownerWithTeam.team.id, 'admin')
    const member1 = await this.createUserWithRole(ownerWithTeam.team.id, 'member')
    const member2 = await this.createUserWithRole(ownerWithTeam.team.id, 'member')

    return {
      team: ownerWithTeam.team,
      users: {
        owner: ownerWithTeam.user,
        admin,
        members: [member1, member2],
      },
    }
  }

  /**
   * Create a user with custom JWT claims for testing impersonation
   */
  async createUserWithCustomClaims(
    claims: Record<string, any>,
    overrides: Partial<UserConfig> = {},
  ): Promise<TestUser> {
    const user = await this.createUser({
      emailPrefix: 'custom-claims',
      metadata: { custom_claims: claims },
      ...overrides,
    })

    return user
  }

  /**
   * Create a batch of users for load testing
   */
  async createUserBatch(count: number, config: Partial<UserConfig> = {}): Promise<TestUser[]> {
    const users: TestUser[] = []
    const batchId = Date.now()

    for (let i = 0; i < count; i++) {
      const user = await this.createUser({
        emailPrefix: `batch-${batchId}-user-${i}`,
        ...config,
      })
      users.push(user)
    }

    return users
  }

  /**
   * Create users with specific authentication states
   */
  async createUserWithAuthState(state: AuthState, overrides: Partial<UserConfig> = {}): Promise<TestUser> {
    const baseConfig = {
      emailPrefix: `${state}-user`,
      ...overrides,
    }

    switch (state) {
      case 'unconfirmed':
        return this.createUser({ ...baseConfig, emailConfirmed: false })

      case 'banned': {
        const bannedUser = await this.createUser(baseConfig)
        // Ban the user
        await this.supabase.auth.admin.updateUserById(bannedUser.id, {
          ban_duration: '24h',
        })
        return bannedUser
      }

      case 'inactive': {
        const inactiveUser = await this.createUser(baseConfig)
        // Set last sign in to long ago
        await this.supabase.auth.admin.updateUserById(inactiveUser.id, {
          user_metadata: { last_active: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
        })
        return inactiveUser
      }

      default:
        return this.createUser(baseConfig)
    }
  }

  /**
   * Get or create a dedicated test team for all test users
   */
  private async getTestTeam(): Promise<string> {
    if (this.testTeamId) {
      return this.testTeamId
    }

    // Try to find existing test team
    const { data: existingTeam } = await this.supabase
      .from('teams')
      .select('id')
      .eq('name', '__TEST_TEAM__')
      .single()

    if (existingTeam) {
      this.testTeamId = existingTeam.id
      return this.testTeamId
    }

    // Create new test team
    const { data: newTeam, error } = await this.supabase
      .from('teams')
      .insert({ name: '__TEST_TEAM__' })
      .select('id')
      .single()

    if (error || !newTeam) {
      throw new Error(`Failed to create test team: ${error?.message}`)
    }

    this.testTeamId = newTeam.id
    this.createdTeams.push(newTeam.id)
    console.log(`[USER-FACTORY] Created test team: ${this.testTeamId}`)
    return this.testTeamId
  }

  /**
   * Clean up all users and teams created by this factory
   * Uses a strategy of deleting teams first (which removes team_members via cleanup function), then users
   * Also cleans up any orphaned test users with common test email patterns
   */
  async cleanup(): Promise<void> {
    const originalTeamCount = this.createdTeams.length
    const originalUserCount = this.createdUsers.length

    console.log(`[USER-FACTORY] cleanup: Starting cleanup. Teams: ${originalTeamCount}, Users: ${originalUserCount}`)

    if (originalTeamCount === 0 && originalUserCount === 0) {
      console.log(`[USER-FACTORY] cleanup: Nothing to cleanup`)
      return
    }

    // Strategy: Delete teams first (which removes team_members via cleanup function)
    // This avoids the "cannot delete last owner" constraint
    console.log(`[USER-FACTORY] cleanup: Step 1 - Cleaning up ${originalTeamCount} teams first...`)
    let teamsDeleted = 0
    for (const teamId of this.createdTeams) {
      try {
        // Use the SQL cleanup function to bypass constraints and remove team_members
        const { error } = await this.supabase.rpc('cleanup_test_team', { team_id_param: teamId })
        if (error) {
          console.error(`[USER-FACTORY] cleanup: Error cleaning up team ${teamId}:`, error)
        }
        else {
          teamsDeleted++
        }
      }
      catch (error) {
        console.error(`[USER-FACTORY] cleanup: Failed to cleanup team ${teamId}:`, error)
      }
    }
    this.createdTeams = []
    this.testTeamId = null

    // Step 2: Now delete users (should succeed since team_members are gone)
    console.log(`[USER-FACTORY] cleanup: Step 2 - Deleting ${originalUserCount} users...`)
    let usersDeleted = 0
    for (const userId of this.createdUsers) {
      try {
        const { error } = await this.supabase.auth.admin.deleteUser(userId)
        if (error) {
          // "User not found" is expected when tests delete users themselves
          if (error.message?.includes('User not found')) {
            console.log(`[USER-FACTORY] cleanup: User ${userId} already deleted (expected)`)
            usersDeleted++
          }
          else {
            console.error(`[USER-FACTORY] cleanup: Error deleting user ${userId}:`, error)
          }
        }
        else {
          usersDeleted++
        }
      }
      catch (error: any) {
        // Handle "User not found" gracefully since some tests delete users
        if (error?.code === 'user_not_found' || error?.status === 404) {
          console.log(`[USER-FACTORY] cleanup: User ${userId} already deleted (expected)`)
          usersDeleted++
        }
        else {
          console.error(`[USER-FACTORY] cleanup: Failed to delete user ${userId}:`, error)
        }
      }
    }
    this.createdUsers = []

    console.log(`[USER-FACTORY] cleanup: Complete. Successfully deleted ${teamsDeleted}/${originalTeamCount} teams and ${usersDeleted}/${originalUserCount} users`)

    // Verify cleanup worked
    if (teamsDeleted < originalTeamCount) {
      console.warn(`[USER-FACTORY] cleanup: WARNING - Only ${teamsDeleted} of ${originalTeamCount} teams were deleted`)
    }
    if (usersDeleted < originalUserCount) {
      console.warn(`[USER-FACTORY] cleanup: WARNING - Only ${usersDeleted} of ${originalUserCount} users were deleted`)
    }
  }

  /**
   * Get count of created users
   */
  getCreatedCount(): number {
    return this.createdUsers.length
  }

  /**
   * Get list of created user IDs
   */
  getCreatedUserIds(): string[] {
    return [...this.createdUsers]
  }
}

// Type definitions
export interface UserConfig {
  emailPrefix: string
  password: string
  emailConfirmed: boolean
  metadata: Record<string, any>
  testDomain: string
}

export interface TeamConfig {
  teamName: string
}

export interface UserWithTeam {
  user: TestUser
  team: {
    id: string
    name: string
    created_by: string
    created_at: string
  }
}

export interface TeamWithUsers {
  team: {
    id: string
    name: string
    created_by: string
    created_at: string
  }
  users: {
    owner: TestUser
    admin: TestUser
    members: TestUser[]
  }
}

export type AuthState = 'confirmed' | 'unconfirmed' | 'banned' | 'inactive'

// Singleton instance for easy access
export const userFactory = new TestUserFactory()

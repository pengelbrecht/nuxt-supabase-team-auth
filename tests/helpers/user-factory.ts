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
      ...overrides,
    }

    const timestamp = Date.now()
    const email = `${config.emailPrefix}-${timestamp}@example.com`

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
   * Clean up all users and teams created by this factory
   * Now works properly with the improved ensure_team_has_owner trigger
   */
  async cleanup(): Promise<void> {
    console.log(`[USER-FACTORY] cleanup: Starting cleanup. Teams: ${this.createdTeams.length}, Users: ${this.createdUsers.length}`)

    // With the improved trigger, we can delete teams directly and it will cascade properly
    // The trigger now allows cascade deletes when the team itself is being deleted

    console.log(`[USER-FACTORY] cleanup: Deleting ${this.createdTeams.length} teams...`)
    for (const teamId of this.createdTeams) {
      try {
        // Delete team directly - the improved trigger allows cascade deletes
        const { error } = await this.supabase
          .from('teams')
          .delete()
          .eq('id', teamId)

        if (error) {
          console.error(`[USER-FACTORY] cleanup: Error deleting team ${teamId}:`, JSON.stringify(error, null, 2))
        }
      }
      catch (error) {
        console.error(`[USER-FACTORY] cleanup: Failed to delete team ${teamId}:`, error)
      }
    }
    const teamsDeleted = this.createdTeams.length
    this.createdTeams = []

    // Delete users - this will clean up auth.users and any remaining data
    console.log(`[USER-FACTORY] cleanup: Deleting ${this.createdUsers.length} users...`)
    for (const userId of this.createdUsers) {
      try {
        const { error } = await this.supabase.auth.admin.deleteUser(userId)
        if (error) {
          console.error(`[USER-FACTORY] cleanup: Error deleting user ${userId}:`, error)
        }
      }
      catch (error) {
        console.error(`[USER-FACTORY] cleanup: Failed to delete user ${userId}:`, error)
      }
    }
    const usersDeleted = this.createdUsers.length
    this.createdUsers = []

    console.log(`[USER-FACTORY] cleanup: Complete. Deleted ${teamsDeleted} teams and ${usersDeleted} users`)
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

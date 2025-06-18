import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

/**
 * Database utilities for testing
 * Provides methods for seeding, cleaning, and managing test data
 */
export class TestDatabase {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  /**
   * Reset the entire test database to a clean state
   */
  async resetDatabase(): Promise<void> {
    try {
      // Delete in correct order to respect foreign key constraints
      await this.supabase.from('impersonation_sessions').delete().neq('id', '')
      await this.supabase.from('invites').delete().neq('id', '')
      await this.supabase.from('team_members').delete().neq('id', '')
      await this.supabase.from('teams').delete().neq('id', '')

      // Clean up auth users (be careful - this is destructive)
      const { data: users } = await this.supabase.auth.admin.listUsers()
      if (users?.users) {
        for (const user of users.users) {
          // Only delete test users (those with test emails)
          if (user.email?.includes('test') || user.email?.includes('e2e')) {
            await this.supabase.auth.admin.deleteUser(user.id)
          }
        }
      }

      console.log('✅ Database reset complete')
    }
    catch (error) {
      console.error('❌ Database reset failed:', error)
      throw error
    }
  }

  /**
   * Clean up specific test data by prefix/pattern
   */
  async cleanupTestData(pattern: string = 'test-'): Promise<void> {
    try {
      // Clean up teams with test pattern
      await this.supabase
        .from('teams')
        .delete()
        .like('name', `%${pattern}%`)

      // Clean up users with test pattern
      const { data: users } = await this.supabase.auth.admin.listUsers()
      if (users?.users) {
        for (const user of users.users) {
          if (user.email?.includes(pattern)) {
            await this.supabase.auth.admin.deleteUser(user.id)
          }
        }
      }

      console.log(`✅ Cleaned up test data with pattern: ${pattern}`)
    }
    catch (error) {
      console.error('❌ Test data cleanup failed:', error)
      throw error
    }
  }

  /**
   * Seed the database with test data
   */
  async seedTestData(): Promise<SeedData> {
    try {
      // Create test users
      const ownerUser = await this.createTestUser('owner@test.com', 'TestPassword123!')
      const adminUser = await this.createTestUser('admin@test.com', 'TestPassword123!')
      const memberUser = await this.createTestUser('member@test.com', 'TestPassword123!')
      const guestUser = await this.createTestUser('guest@test.com', 'TestPassword123!')

      // Create test team
      const team = await this.createTestTeam('Test Team', ownerUser.id)

      // Add team members with roles
      await this.addTeamMember(team.id, ownerUser.id, 'owner')
      await this.addTeamMember(team.id, adminUser.id, 'admin')
      await this.addTeamMember(team.id, memberUser.id, 'member')

      // Create some test invitations
      const pendingInvite = await this.createTestInvite(team.id, 'pending@test.com', 'member')
      const expiredInvite = await this.createTestInvite(team.id, 'expired@test.com', 'member', true)

      const seedData: SeedData = {
        users: {
          owner: ownerUser,
          admin: adminUser,
          member: memberUser,
          guest: guestUser,
        },
        team,
        invites: {
          pending: pendingInvite,
          expired: expiredInvite,
        },
      }

      console.log('✅ Test data seeded successfully')
      return seedData
    }
    catch (error) {
      console.error('❌ Test data seeding failed:', error)
      throw error
    }
  }

  /**
   * Create a test user with specified email and password
   */
  async createTestUser(email: string, password: string): Promise<TestUser> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      throw new Error(`Failed to create test user: ${error?.message}`)
    }

    return {
      id: data.user.id,
      email: data.user.email!,
      password,
    }
  }

  /**
   * Create a test team
   */
  async createTestTeam(name: string, createdBy: string): Promise<TestTeam> {
    const { data, error } = await this.supabase
      .from('teams')
      .insert({
        name,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create test team: ${error?.message}`)
    }

    return {
      id: data.id,
      name: data.name,
      created_by: data.created_by,
      created_at: data.created_at,
    }
  }

  /**
   * Add a member to a team with specified role
   */
  async addTeamMember(teamId: string, userId: string, role: TeamRole): Promise<void> {
    const { error } = await this.supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
      })

    if (error) {
      throw new Error(`Failed to add team member: ${error.message}`)
    }
  }

  /**
   * Create a test invitation
   */
  async createTestInvite(
    teamId: string,
    email: string,
    role: TeamRole,
    expired: boolean = false,
  ): Promise<TestInvite> {
    const expiresAt = expired
      ? new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    const { data, error } = await this.supabase
      .from('invites')
      .insert({
        team_id: teamId,
        email,
        role,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create test invite: ${error?.message}`)
    }

    return {
      id: data.id,
      team_id: data.team_id,
      email: data.email,
      role: data.role,
      status: data.status,
      expires_at: data.expires_at,
    }
  }

  /**
   * Get database statistics for testing
   */
  async getStats(): Promise<DatabaseStats> {
    const [usersResult, teamsResult, membersResult, invitesResult] = await Promise.all([
      this.supabase.auth.admin.listUsers(),
      this.supabase.from('teams').select('id'),
      this.supabase.from('team_members').select('id'),
      this.supabase.from('invites').select('id'),
    ])

    return {
      users: usersResult.data?.users?.length || 0,
      teams: teamsResult.data?.length || 0,
      teamMembers: membersResult.data?.length || 0,
      invites: invitesResult.data?.length || 0,
    }
  }

  /**
   * Verify database state matches expectations
   */
  async verifyState(expectedState: Partial<DatabaseStats>): Promise<boolean> {
    const actualState = await this.getStats()

    for (const [key, expectedValue] of Object.entries(expectedState)) {
      if (actualState[key as keyof DatabaseStats] !== expectedValue) {
        console.error(`State mismatch for ${key}: expected ${expectedValue}, got ${actualState[key as keyof DatabaseStats]}`)
        return false
      }
    }

    return true
  }

  /**
   * Get the Supabase client for direct access
   */
  getClient(): SupabaseClient {
    return this.supabase
  }
}

// Type definitions
export interface TestUser {
  id: string
  email: string
  password: string
}

export interface TestTeam {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface TestInvite {
  id: string
  team_id: string
  email: string
  role: TeamRole
  status: string
  expires_at: string
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'super_admin'

export interface SeedData {
  users: {
    owner: TestUser
    admin: TestUser
    member: TestUser
    guest: TestUser
  }
  team: TestTeam
  invites: {
    pending: TestInvite
    expired: TestInvite
  }
}

export interface DatabaseStats {
  users: number
  teams: number
  teamMembers: number
  invites: number
}

// Singleton instance for easy access
export const testDb = new TestDatabase()

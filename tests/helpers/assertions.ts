import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import type { TeamRole } from './database'

/**
 * Database state assertion helpers for testing
 */
export class DatabaseAssertions {
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

  // User Assertions
  async assertUserExists(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId)
    if (error) throw new Error(`Failed to check user existence: ${error.message}`)
    return !!data.user
  }

  async assertUserNotExists(userId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase.auth.admin.getUserById(userId)
      return !data.user
    }
    catch {
      return true // User doesn't exist
    }
  }

  async assertUserEmail(userId: string, expectedEmail: string): Promise<boolean> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId)
    if (error) throw new Error(`Failed to get user: ${error.message}`)
    return data.user?.email === expectedEmail
  }

  async assertUserEmailConfirmed(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId)
    if (error) throw new Error(`Failed to get user: ${error.message}`)
    return !!data.user?.email_confirmed_at
  }

  // Team Assertions
  async assertTeamExists(teamId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check team existence: ${error.message}`)
    }
    return !!data
  }

  async assertTeamNotExists(teamId: string): Promise<boolean> {
    const { data: _data, error } = await this.supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single()

    return error?.code === 'PGRST116' // No rows found
  }

  async assertTeamName(teamId: string, expectedName: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (error) throw new Error(`Failed to get team: ${error.message}`)
    return data.name === expectedName
  }

  async assertTeamCreatedBy(teamId: string, expectedCreatorId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single()

    if (error) throw new Error(`Failed to get team: ${error.message}`)
    return data.created_by === expectedCreatorId
  }

  // Team Member Assertions
  async assertUserIsTeamMember(userId: string, teamId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check team membership: ${error.message}`)
    }
    return !!data
  }

  async assertUserNotTeamMember(userId: string, teamId: string): Promise<boolean> {
    const { data: _data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    return error?.code === 'PGRST116' // No rows found
  }

  async assertUserTeamRole(userId: string, teamId: string, expectedRole: TeamRole): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    if (error) throw new Error(`Failed to get user role: ${error.message}`)
    return data.role === expectedRole
  }

  async assertTeamMemberCount(teamId: string, expectedCount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)

    if (error) throw new Error(`Failed to count team members: ${error.message}`)
    return data.length === expectedCount
  }

  async assertTeamRoleCount(teamId: string, role: TeamRole, expectedCount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', role)

    if (error) throw new Error(`Failed to count team role: ${error.message}`)
    return data.length === expectedCount
  }

  // Invitation Assertions
  async assertInvitationExists(inviteId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('id')
      .eq('id', inviteId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check invitation existence: ${error.message}`)
    }
    return !!data
  }

  async assertInvitationNotExists(inviteId: string): Promise<boolean> {
    const { data: _data, error } = await this.supabase
      .from('invites')
      .select('id')
      .eq('id', inviteId)
      .single()

    return error?.code === 'PGRST116' // No rows found
  }

  async assertInvitationStatus(inviteId: string, expectedStatus: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('status')
      .eq('id', inviteId)
      .single()

    if (error) throw new Error(`Failed to get invitation status: ${error.message}`)
    return data.status === expectedStatus
  }

  async assertInvitationEmail(inviteId: string, expectedEmail: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('email')
      .eq('id', inviteId)
      .single()

    if (error) throw new Error(`Failed to get invitation email: ${error.message}`)
    return data.email === expectedEmail
  }

  async assertTeamInvitationCount(teamId: string, expectedCount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('id')
      .eq('team_id', teamId)

    if (error) throw new Error(`Failed to count team invitations: ${error.message}`)
    return data.length === expectedCount
  }

  async assertPendingInvitationCount(teamId: string, expectedCount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'pending')

    if (error) throw new Error(`Failed to count pending invitations: ${error.message}`)
    return data.length === expectedCount
  }

  // Impersonation Assertions
  async assertImpersonationSessionExists(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('impersonation_sessions')
      .select('id')
      .eq('id', sessionId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check impersonation session: ${error.message}`)
    }
    return !!data
  }

  async assertActiveImpersonationSessions(adminUserId: string, expectedCount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('impersonation_sessions')
      .select('id')
      .eq('admin_user_id', adminUserId)
      .eq('status', 'active')

    if (error) throw new Error(`Failed to count active impersonation sessions: ${error.message}`)
    return data.length === expectedCount
  }

  async assertImpersonationSessionEnded(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('impersonation_sessions')
      .select('ended_at, status')
      .eq('id', sessionId)
      .single()

    if (error) throw new Error(`Failed to get impersonation session: ${error.message}`)
    return !!data.ended_at && data.status === 'ended'
  }

  // Complex Assertions
  async assertTeamStructure(teamId: string, expectedStructure: TeamStructure): Promise<boolean> {
    const [
      ownerCount,
      adminCount,
      memberCount,
      totalMembers,
    ] = await Promise.all([
      this.assertTeamRoleCount(teamId, 'owner', expectedStructure.owners),
      this.assertTeamRoleCount(teamId, 'admin', expectedStructure.admins),
      this.assertTeamRoleCount(teamId, 'member', expectedStructure.members),
      this.assertTeamMemberCount(teamId, expectedStructure.total),
    ])

    return ownerCount && adminCount && memberCount && totalMembers
  }

  async assertUserPermissions(userId: string, teamId: string, expectedPermissions: UserPermissions): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    if (error) {
      if (expectedPermissions.isMember === false && error.code === 'PGRST116') {
        return true // User is not a member, as expected
      }
      throw new Error(`Failed to get user permissions: ${error.message}`)
    }

    const role = data.role as TeamRole
    const actualPermissions = this.getRolePermissions(role)

    return (
      actualPermissions.canInvite === expectedPermissions.canInvite
      && actualPermissions.canPromote === expectedPermissions.canPromote
      && actualPermissions.canRemove === expectedPermissions.canRemove
      && actualPermissions.canDelete === expectedPermissions.canDelete
      && actualPermissions.canTransferOwnership === expectedPermissions.canTransferOwnership
    )
  }

  // Batch Assertions
  async assertBatchUserExistence(userIds: string[], shouldExist: boolean = true): Promise<boolean> {
    for (const userId of userIds) {
      const exists = await this.assertUserExists(userId)
      if (exists !== shouldExist) {
        return false
      }
    }
    return true
  }

  async assertBatchTeamMembership(userIds: string[], teamId: string, shouldBeMember: boolean = true): Promise<boolean> {
    for (const userId of userIds) {
      const isMember = await this.assertUserIsTeamMember(userId, teamId)
      if (isMember !== shouldBeMember) {
        return false
      }
    }
    return true
  }

  // Helper Methods
  private getRolePermissions(role: TeamRole): UserPermissions {
    switch (role) {
      case 'owner':
        return {
          isMember: true,
          canInvite: true,
          canPromote: true,
          canRemove: true,
          canDelete: true,
          canTransferOwnership: true,
        }
      case 'admin':
        return {
          isMember: true,
          canInvite: true,
          canPromote: false,
          canRemove: true,
          canDelete: false,
          canTransferOwnership: false,
        }
      case 'member':
        return {
          isMember: true,
          canInvite: false,
          canPromote: false,
          canRemove: false,
          canDelete: false,
          canTransferOwnership: false,
        }
      default:
        return {
          isMember: false,
          canInvite: false,
          canPromote: false,
          canRemove: false,
          canDelete: false,
          canTransferOwnership: false,
        }
    }
  }
}

// Type definitions
export interface TeamStructure {
  owners: number
  admins: number
  members: number
  total: number
}

export interface UserPermissions {
  isMember: boolean
  canInvite: boolean
  canPromote: boolean
  canRemove: boolean
  canDelete: boolean
  canTransferOwnership: boolean
}

// Test helper functions
export function expectDatabaseState(assertions: DatabaseAssertions) {
  return {
    userExists: (userId: string) => expect(assertions.assertUserExists(userId)).resolves.toBe(true),
    userNotExists: (userId: string) => expect(assertions.assertUserNotExists(userId)).resolves.toBe(true),
    teamExists: (teamId: string) => expect(assertions.assertTeamExists(teamId)).resolves.toBe(true),
    teamNotExists: (teamId: string) => expect(assertions.assertTeamNotExists(teamId)).resolves.toBe(true),
    userIsTeamMember: (userId: string, teamId: string) =>
      expect(assertions.assertUserIsTeamMember(userId, teamId)).resolves.toBe(true),
    userNotTeamMember: (userId: string, teamId: string) =>
      expect(assertions.assertUserNotTeamMember(userId, teamId)).resolves.toBe(true),
    userHasRole: (userId: string, teamId: string, role: TeamRole) =>
      expect(assertions.assertUserTeamRole(userId, teamId, role)).resolves.toBe(true),
    teamMemberCount: (teamId: string, count: number) =>
      expect(assertions.assertTeamMemberCount(teamId, count)).resolves.toBe(true),
    invitationExists: (inviteId: string) =>
      expect(assertions.assertInvitationExists(inviteId)).resolves.toBe(true),
    invitationNotExists: (inviteId: string) =>
      expect(assertions.assertInvitationNotExists(inviteId)).resolves.toBe(true),
    teamStructure: (teamId: string, structure: TeamStructure) =>
      expect(assertions.assertTeamStructure(teamId, structure)).resolves.toBe(true),
  }
}

// Singleton instance for easy access
export const dbAssertions = new DatabaseAssertions()

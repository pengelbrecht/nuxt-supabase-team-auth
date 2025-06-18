import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import type { TestUser, TestTeam, TeamRole } from './database'
import { userFactory } from './user-factory'

/**
 * Factory for creating test teams with various configurations
 */
export class TestTeamFactory {
  private supabase: SupabaseClient
  private createdTeams: string[] = []

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
   * Create a basic team
   */
  async createTeam(name: string, createdBy: string): Promise<TestTeam> {
    const { data, error } = await this.supabase
      .from('teams')
      .insert({
        name,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create team: ${error?.message}`)
    }

    // Track created team for cleanup
    this.createdTeams.push(data.id)

    return {
      id: data.id,
      name: data.name,
      created_by: data.created_by,
      created_at: data.created_at,
    }
  }

  /**
   * Create a team with a specific member structure
   */
  async createTeamWithMembers(config: TeamMemberConfig): Promise<TeamWithMembers> {
    const timestamp = Date.now()
    const teamName = config.name || `Test Team ${timestamp}`

    // Create owner if not provided
    let owner: TestUser
    if (config.owner) {
      owner = config.owner
    }
    else {
      owner = await userFactory.createUser({
        emailPrefix: 'team-owner',
      })
    }

    // Create the team
    const team = await this.createTeam(teamName, owner.id)

    // Add owner to team
    await this.addMember(team.id, owner.id, 'owner')

    const members: TeamMemberRecord[] = [
      { user: owner, role: 'owner' },
    ]

    // Create and add admins
    for (let i = 0; i < (config.adminCount || 0); i++) {
      const admin = await userFactory.createUser({
        emailPrefix: `team-admin-${i}`,
      })
      await this.addMember(team.id, admin.id, 'admin')
      members.push({ user: admin, role: 'admin' })
    }

    // Create and add members
    for (let i = 0; i < (config.memberCount || 0); i++) {
      const member = await userFactory.createUser({
        emailPrefix: `team-member-${i}`,
      })
      await this.addMember(team.id, member.id, 'member')
      members.push({ user: member, role: 'member' })
    }

    return {
      team,
      members,
      owner,
      admins: members.filter(m => m.role === 'admin').map(m => m.user),
      regularMembers: members.filter(m => m.role === 'member').map(m => m.user),
    }
  }

  /**
   * Create a team with complex role hierarchy
   */
  async createComplexTeam(): Promise<ComplexTeam> {
    const timestamp = Date.now()
    const teamName = `Complex Team ${timestamp}`

    // Create various users
    const owner = await userFactory.createUser({ emailPrefix: 'complex-owner' })
    const seniorAdmin = await userFactory.createUser({ emailPrefix: 'senior-admin' })
    const juniorAdmin = await userFactory.createUser({ emailPrefix: 'junior-admin' })
    const leadMember = await userFactory.createUser({ emailPrefix: 'lead-member' })
    const regularMembers = await userFactory.createUserBatch(3, { emailPrefix: 'regular-member' })

    // Create team
    const team = await this.createTeam(teamName, owner.id)

    // Add members with roles
    await this.addMember(team.id, owner.id, 'owner')
    await this.addMember(team.id, seniorAdmin.id, 'admin')
    await this.addMember(team.id, juniorAdmin.id, 'admin')
    await this.addMember(team.id, leadMember.id, 'member')

    for (const member of regularMembers) {
      await this.addMember(team.id, member.id, 'member')
    }

    return {
      team,
      owner,
      admins: {
        senior: seniorAdmin,
        junior: juniorAdmin,
      },
      members: {
        lead: leadMember,
        regular: regularMembers,
      },
    }
  }

  /**
   * Create a team with pending invitations
   */
  async createTeamWithInvitations(config: TeamInvitationConfig): Promise<TeamWithInvitations> {
    const teamWithMembers = await this.createTeamWithMembers({
      name: config.teamName,
      adminCount: 1,
      memberCount: 1,
    })

    const invitations: InvitationRecord[] = []

    // Create pending invitations
    for (let i = 0; i < (config.pendingInvites || 0); i++) {
      const email = `pending-invite-${Date.now()}-${i}@example.com`
      const invitation = await this.createInvitation(
        teamWithMembers.team.id,
        email,
        'member',
      )
      invitations.push({ ...invitation, status: 'pending' })
    }

    // Create expired invitations
    for (let i = 0; i < (config.expiredInvites || 0); i++) {
      const email = `expired-invite-${Date.now()}-${i}@example.com`
      const invitation = await this.createInvitation(
        teamWithMembers.team.id,
        email,
        'member',
        true, // expired
      )
      invitations.push({ ...invitation, status: 'expired' })
    }

    return {
      ...teamWithMembers,
      invitations,
    }
  }

  /**
   * Create multiple teams for testing cross-team scenarios
   */
  async createMultipleTeams(count: number, config: Partial<TeamMemberConfig> = {}): Promise<TeamWithMembers[]> {
    const teams: TeamWithMembers[] = []

    for (let i = 0; i < count; i++) {
      const team = await this.createTeamWithMembers({
        name: `Multi Team ${i + 1} ${Date.now()}`,
        adminCount: 1,
        memberCount: 2,
        ...config,
      })
      teams.push(team)
    }

    return teams
  }

  /**
   * Add a member to a team
   */
  async addMember(teamId: string, userId: string, role: TeamRole): Promise<void> {
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
   * Remove a member from a team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to remove team member: ${error.message}`)
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<void> {
    const { error } = await this.supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('team_id', teamId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`)
    }
  }

  /**
   * Create an invitation
   */
  async createInvitation(
    teamId: string,
    email: string,
    role: TeamRole,
    expired: boolean = false,
  ): Promise<InvitationRecord> {
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
        status: expired ? 'expired' : 'pending',
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create invitation: ${error?.message}`)
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
   * Get team statistics
   */
  async getTeamStats(teamId: string): Promise<TeamStats> {
    const [membersResult, invitesResult] = await Promise.all([
      this.supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId),
      this.supabase
        .from('invites')
        .select('status')
        .eq('team_id', teamId),
    ])

    const members = membersResult.data || []
    const invites = invitesResult.data || []

    return {
      totalMembers: members.length,
      owners: members.filter(m => m.role === 'owner').length,
      admins: members.filter(m => m.role === 'admin').length,
      regularMembers: members.filter(m => m.role === 'member').length,
      pendingInvites: invites.filter(i => i.status === 'pending').length,
      expiredInvites: invites.filter(i => i.status === 'expired').length,
    }
  }

  /**
   * Clean up all teams created by this factory
   */
  async cleanup(): Promise<void> {
    for (const teamId of this.createdTeams) {
      try {
        // Delete team members first
        await this.supabase.from('team_members').delete().eq('team_id', teamId)
        // Delete invitations
        await this.supabase.from('invites').delete().eq('team_id', teamId)
        // Delete team
        await this.supabase.from('teams').delete().eq('id', teamId)
      }
      catch (error) {
        console.warn(`Failed to delete team ${teamId}:`, error)
      }
    }
    this.createdTeams = []
  }

  /**
   * Get count of created teams
   */
  getCreatedCount(): number {
    return this.createdTeams.length
  }
}

// Type definitions
export interface TeamMemberConfig {
  name?: string
  owner?: TestUser
  adminCount?: number
  memberCount?: number
}

export interface TeamMemberRecord {
  user: TestUser
  role: TeamRole
}

export interface TeamWithMembers {
  team: TestTeam
  members: TeamMemberRecord[]
  owner: TestUser
  admins: TestUser[]
  regularMembers: TestUser[]
}

export interface ComplexTeam {
  team: TestTeam
  owner: TestUser
  admins: {
    senior: TestUser
    junior: TestUser
  }
  members: {
    lead: TestUser
    regular: TestUser[]
  }
}

export interface TeamInvitationConfig extends TeamMemberConfig {
  teamName?: string
  pendingInvites?: number
  expiredInvites?: number
}

export interface InvitationRecord {
  id: string
  team_id: string
  email: string
  role: TeamRole
  status: string
  expires_at: string
}

export interface TeamWithInvitations extends TeamWithMembers {
  invitations: InvitationRecord[]
}

export interface TeamStats {
  totalMembers: number
  owners: number
  admins: number
  regularMembers: number
  pendingInvites: number
  expiredInvites: number
}

// Singleton instance for easy access
export const teamFactory = new TestTeamFactory()

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { TeamRole } from './database'

/**
 * Invitation and role management testing utilities
 */
export class InvitationHelpers {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  /**
   * Create a test invitation with specific properties
   */
  async createInvitation(config: InvitationConfig): Promise<TestInvitation> {
    const expiresAt = config.expiresInHours 
      ? new Date(Date.now() + config.expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days

    const { data, error } = await this.supabase
      .from('invites')
      .insert({
        team_id: config.teamId,
        email: config.email,
        role: config.role,
        invited_by: config.invitedBy,
        expires_at: expiresAt.toISOString(),
        status: config.status || 'pending',
        message: config.customMessage
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
      invited_by: data.invited_by,
      status: data.status,
      expires_at: data.expires_at,
      message: data.message,
      created_at: data.created_at
    }
  }

  /**
   * Create multiple invitations for batch testing
   */
  async createBatchInvitations(
    teamId: string, 
    invitedBy: string, 
    configs: BatchInvitationConfig[]
  ): Promise<TestInvitation[]> {
    const invitations: TestInvitation[] = []

    for (const config of configs) {
      const invitation = await this.createInvitation({
        teamId,
        invitedBy,
        email: config.email,
        role: config.role,
        expiresInHours: config.expiresInHours,
        status: config.status,
        customMessage: config.customMessage
      })
      invitations.push(invitation)
    }

    return invitations
  }

  /**
   * Create invitations with different expiration states
   */
  async createInvitationsWithExpirationStates(
    teamId: string, 
    invitedBy: string
  ): Promise<ExpirationTestSet> {
    const timestamp = Date.now()

    const [valid, expiringSoon, expired, longTerm] = await Promise.all([
      this.createInvitation({
        teamId,
        invitedBy,
        email: `valid-${timestamp}@example.com`,
        role: 'member',
        expiresInHours: 24 // 1 day
      }),
      this.createInvitation({
        teamId,
        invitedBy,
        email: `expiring-${timestamp}@example.com`,
        role: 'member',
        expiresInHours: 1 // 1 hour
      }),
      this.createInvitation({
        teamId,
        invitedBy,
        email: `expired-${timestamp}@example.com`,
        role: 'member',
        expiresInHours: -24, // Already expired
        status: 'expired'
      }),
      this.createInvitation({
        teamId,
        invitedBy,
        email: `longterm-${timestamp}@example.com`,
        role: 'admin',
        expiresInHours: 7 * 24 // 7 days
      })
    ])

    return { valid, expiringSoon, expired, longTerm }
  }

  /**
   * Accept an invitation (simulate user accepting)
   */
  async acceptInvitation(invitationId: string, acceptingUserId: string): Promise<void> {
    const { error } = await this.supabase
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: acceptingUserId
      })
      .eq('id', invitationId)

    if (error) {
      throw new Error(`Failed to accept invitation: ${error.message}`)
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string, decliningUserId?: string): Promise<void> {
    const { error } = await this.supabase
      .from('invites')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        declined_by: decliningUserId
      })
      .eq('id', invitationId)

    if (error) {
      throw new Error(`Failed to decline invitation: ${error.message}`)
    }
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(invitationId: string, revokingUserId: string): Promise<void> {
    const { error } = await this.supabase
      .from('invites')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: revokingUserId
      })
      .eq('id', invitationId)

    if (error) {
      throw new Error(`Failed to revoke invitation: ${error.message}`)
    }
  }

  /**
   * Expire invitations manually for testing
   */
  async expireInvitations(invitationIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('invites')
      .update({
        status: 'expired',
        expires_at: new Date(Date.now() - 1000).toISOString() // 1 second ago
      })
      .in('id', invitationIds)

    if (error) {
      throw new Error(`Failed to expire invitations: ${error.message}`)
    }
  }

  /**
   * Get invitation statistics for a team
   */
  async getInvitationStats(teamId: string): Promise<InvitationStats> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('status, role')
      .eq('team_id', teamId)

    if (error) {
      throw new Error(`Failed to get invitation stats: ${error.message}`)
    }

    const stats: InvitationStats = {
      total: data.length,
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      revoked: 0,
      byRole: {
        owner: 0,
        admin: 0,
        member: 0,
        super_admin: 0
      }
    }

    data.forEach(invite => {
      stats[invite.status as keyof InvitationStats]++
      stats.byRole[invite.role as TeamRole]++
    })

    return stats
  }

  /**
   * Simulate invitation workflow
   */
  async simulateInvitationWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
    const invitation = await this.createInvitation({
      teamId: config.teamId,
      invitedBy: config.invitedBy,
      email: config.email,
      role: config.role
    })

    const result: WorkflowResult = {
      invitation,
      steps: [`Invitation created for ${config.email}`]
    }

    // Simulate acceptance or decline based on config
    if (config.shouldAccept && config.acceptingUserId) {
      await this.acceptInvitation(invitation.id, config.acceptingUserId)
      result.steps.push('Invitation accepted')
      
      // Add user to team
      const { error } = await this.supabase
        .from('team_members')
        .insert({
          team_id: config.teamId,
          user_id: config.acceptingUserId,
          role: config.role
        })

      if (error) {
        result.steps.push(`Failed to add to team: ${error.message}`)
      } else {
        result.steps.push('User added to team successfully')
      }
    } else if (config.shouldDecline) {
      await this.declineInvitation(invitation.id)
      result.steps.push('Invitation declined')
    } else if (config.shouldRevoke && config.revokingUserId) {
      await this.revokeInvitation(invitation.id, config.revokingUserId)
      result.steps.push('Invitation revoked')
    }

    return result
  }

  /**
   * Clean up test invitations
   */
  async cleanupInvitations(teamId?: string): Promise<void> {
    let query = this.supabase.from('invites').delete()
    
    if (teamId) {
      query = query.eq('team_id', teamId)
    } else {
      // Only clean up test invitations (with test emails)
      query = query.like('email', '%test%')
    }

    const { error } = await query

    if (error) {
      throw new Error(`Failed to cleanup invitations: ${error.message}`)
    }
  }

  /**
   * Get pending invitations for a team
   */
  async getPendingInvitations(teamId: string): Promise<TestInvitation[]> {
    const { data, error } = await this.supabase
      .from('invites')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get pending invitations: ${error.message}`)
    }

    return data.map(invite => ({
      id: invite.id,
      team_id: invite.team_id,
      email: invite.email,
      role: invite.role,
      invited_by: invite.invited_by,
      status: invite.status,
      expires_at: invite.expires_at,
      message: invite.message,
      created_at: invite.created_at
    }))
  }
}

/**
 * Role testing utilities
 */
export class RoleHelpers {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  /**
   * Change a user's role in a team
   */
  async changeUserRole(userId: string, teamId: string, newRole: TeamRole): Promise<RoleChangeResult> {
    const { data: oldData, error: fetchError } = await this.supabase
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch current role: ${fetchError.message}`)
    }

    const oldRole = oldData.role

    const { error: updateError } = await this.supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('team_id', teamId)

    if (updateError) {
      throw new Error(`Failed to update role: ${updateError.message}`)
    }

    return {
      userId,
      teamId,
      oldRole,
      newRole,
      changedAt: new Date().toISOString()
    }
  }

  /**
   * Test role hierarchy rules
   */
  async testRoleHierarchy(teamId: string): Promise<RoleHierarchyTest> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)

    if (error) {
      throw new Error(`Failed to get team members: ${error.message}`)
    }

    const roleGroups = {
      owners: data.filter(m => m.role === 'owner'),
      admins: data.filter(m => m.role === 'admin'),
      members: data.filter(m => m.role === 'member'),
      superAdmins: data.filter(m => m.role === 'super_admin')
    }

    const issues: string[] = []

    // Check hierarchy rules
    if (roleGroups.owners.length === 0) {
      issues.push('Team must have at least one owner')
    }
    if (roleGroups.owners.length > 1) {
      issues.push('Team should have only one owner')
    }
    if (roleGroups.superAdmins.length > 0) {
      issues.push('Super admins should not be team members')
    }

    return {
      teamId,
      roleGroups,
      issues,
      isValid: issues.length === 0
    }
  }

  /**
   * Get role permissions for testing
   */
  getRolePermissions(role: TeamRole): RolePermissions {
    const permissions: Record<TeamRole, RolePermissions> = {
      owner: {
        canInviteMembers: true,
        canRemoveMembers: true,
        canPromoteToAdmin: true,
        canDemoteFromAdmin: true,
        canTransferOwnership: true,
        canDeleteTeam: true,
        canModifyTeamSettings: true,
        canViewAllMembers: true,
        canStartImpersonation: false
      },
      admin: {
        canInviteMembers: true,
        canRemoveMembers: true,
        canPromoteToAdmin: false,
        canDemoteFromAdmin: false,
        canTransferOwnership: false,
        canDeleteTeam: false,
        canModifyTeamSettings: true,
        canViewAllMembers: true,
        canStartImpersonation: false
      },
      member: {
        canInviteMembers: false,
        canRemoveMembers: false,
        canPromoteToAdmin: false,
        canDemoteFromAdmin: false,
        canTransferOwnership: false,
        canDeleteTeam: false,
        canModifyTeamSettings: false,
        canViewAllMembers: true,
        canStartImpersonation: false
      },
      super_admin: {
        canInviteMembers: true,
        canRemoveMembers: true,
        canPromoteToAdmin: true,
        canDemoteFromAdmin: true,
        canTransferOwnership: false,
        canDeleteTeam: false,
        canModifyTeamSettings: false,
        canViewAllMembers: true,
        canStartImpersonation: true
      }
    }

    return permissions[role]
  }

  /**
   * Test if a user can perform an action based on their role
   */
  async canUserPerformAction(
    userId: string, 
    teamId: string, 
    action: keyof RolePermissions
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .single()

    if (error) {
      return false // User is not a team member
    }

    const permissions = this.getRolePermissions(data.role as TeamRole)
    return permissions[action]
  }
}

// Type definitions
export interface InvitationConfig {
  teamId: string
  email: string
  role: TeamRole
  invitedBy: string
  expiresInHours?: number
  status?: string
  customMessage?: string
}

export interface BatchInvitationConfig {
  email: string
  role: TeamRole
  expiresInHours?: number
  status?: string
  customMessage?: string
}

export interface TestInvitation {
  id: string
  team_id: string
  email: string
  role: TeamRole
  invited_by: string
  status: string
  expires_at: string
  message?: string
  created_at: string
}

export interface ExpirationTestSet {
  valid: TestInvitation
  expiringSoon: TestInvitation
  expired: TestInvitation
  longTerm: TestInvitation
}

export interface InvitationStats {
  total: number
  pending: number
  accepted: number
  declined: number
  expired: number
  revoked: number
  byRole: Record<TeamRole, number>
}

export interface WorkflowConfig {
  teamId: string
  invitedBy: string
  email: string
  role: TeamRole
  shouldAccept?: boolean
  shouldDecline?: boolean
  shouldRevoke?: boolean
  acceptingUserId?: string
  revokingUserId?: string
}

export interface WorkflowResult {
  invitation: TestInvitation
  steps: string[]
}

export interface RoleChangeResult {
  userId: string
  teamId: string
  oldRole: TeamRole
  newRole: TeamRole
  changedAt: string
}

export interface RoleHierarchyTest {
  teamId: string
  roleGroups: {
    owners: Array<{ user_id: string; role: string }>
    admins: Array<{ user_id: string; role: string }>
    members: Array<{ user_id: string; role: string }>
    superAdmins: Array<{ user_id: string; role: string }>
  }
  issues: string[]
  isValid: boolean
}

export interface RolePermissions {
  canInviteMembers: boolean
  canRemoveMembers: boolean
  canPromoteToAdmin: boolean
  canDemoteFromAdmin: boolean
  canTransferOwnership: boolean
  canDeleteTeam: boolean
  canModifyTeamSettings: boolean
  canViewAllMembers: boolean
  canStartImpersonation: boolean
}

// Singleton instances for easy access
export const invitationHelpers = new InvitationHelpers()
export const roleHelpers = new RoleHelpers()
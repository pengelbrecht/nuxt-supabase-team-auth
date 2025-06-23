import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbProfile, DbTeam, DbTeamMember, DbInvite, DbImpersonationSession, TeamRole } from './database.types'

export interface User {
  id: string
  email: string
  user_metadata?: {
    // Standard Supabase auth field for user's display name
    name?: string
    avatar_url?: string
  }
}

// Use Supabase-generated types
export type Profile = DbProfile
export type Team = DbTeam
export type TeamMember = DbTeamMember

export type Invite = DbInvite
export type ImpersonationSession = DbImpersonationSession

export interface TeamAuthState {
  currentUser: Ref<User | null>
  currentTeam: Ref<Team | null>
  currentRole: Ref<string | null>
  isLoading: Ref<boolean>
  isImpersonating: Ref<boolean>
  impersonationExpiresAt: Ref<Date | null>
}

export interface SessionHealthResult {
  isHealthy: boolean
  issues: string[]
}

export interface ActiveTab {
  tabId: string
  timestamp: number
  url: string
}

export interface TeamAuthMethods {
  signUpWithTeam: (email: string, password: string, teamName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  inviteMember: (email: string, role?: string) => Promise<void>
  revokeInvite: (inviteId: string) => Promise<void>
  resendInvite: (inviteId: string) => Promise<void>
  promote: (userId: string) => Promise<void>
  demote: (userId: string) => Promise<void>
  transferOwnership: (userId: string) => Promise<void>
  getProfile: () => Promise<Profile | null>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  renameTeam: (name: string) => Promise<void>
  updateTeam: (updates: Partial<Team>) => Promise<void>
  deleteTeam: () => Promise<void>
  startImpersonation: (targetUserId: string, reason: string) => Promise<void>
  stopImpersonation: () => Promise<void>
  getAvatarFallback: (overrides?: { fullName?: string | null, email?: string | null }) => string
  getTeamMembers: () => Promise<void>
  updateMemberRole: (userId: string, role: string) => Promise<void>
  removeMember: (userId: string) => Promise<void>
  getTeamMemberProfile: (userId: string) => Promise<Profile | null>
  updateTeamMemberProfile: (userId: string, updates: Partial<Profile>) => Promise<void>

  // Session management utilities
  sessionHealth: () => SessionHealthResult
  triggerSessionRecovery: () => void
  getActiveTabs: () => ActiveTab[]
  isTabPrimary: boolean
}

export type TeamAuth = TeamAuthState & TeamAuthMethods

declare global {
  interface Window {
    __NUXT_TEAM_AUTH_CLIENT__?: SupabaseClient
  }
}

declare module '#app' {
  interface NuxtApp {
    $teamAuthClient: SupabaseClient
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $teamAuthClient: SupabaseClient
  }
}

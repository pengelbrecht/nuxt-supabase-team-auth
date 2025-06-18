import type { SupabaseClient } from '@supabase/supabase-js'

export interface User {
  id: string
  email: string
  user_metadata?: {
    // Standard Supabase auth field for user's display name
    name?: string
    avatar_url?: string
  }
}

export interface Profile {
  id: string
  full_name?: string
  avatar_url?: string
  phone?: string
  bio?: string
  timezone?: string
  language?: string
  email_notifications?: boolean
  marketing_emails?: boolean
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  address?: string
  vat_number?: string
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'super_admin'
  joined_at: string
}

export interface Invite {
  id: string
  team_id: string
  email: string
  token_hash: string
  expires_at: string
  status: 'pending' | 'accepted' | 'revoked'
}

export interface ImpersonationSession {
  id: string
  admin_user_id: string
  target_user_id: string
  started_at: string
  ended_at?: string
  reason: string
}

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
  deleteTeam: () => Promise<void>
  startImpersonation: (targetUserId: string, reason: string) => Promise<void>
  stopImpersonation: () => Promise<void>
  getAvatarFallback: (overrides?: { fullName?: string | null, email?: string | null }) => string

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

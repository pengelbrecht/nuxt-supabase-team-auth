// Types - we'll use types from @nuxtjs/supabase composables
import type { Ref, ComputedRef } from 'vue'
import type { DbProfile, DbTeam, DbTeamMember, DbImpersonationSession } from './database.types'

// Removed unused SupabaseClient type

// Re-export password policy types
export type { PasswordPolicy, PasswordValidationResult } from './password-policy'

// Social Provider Configuration Types
export interface SocialProviderConfig {
  enabled: boolean
  // Future fields for OAuth configuration
  clientId?: string
  redirectUrl?: string
  scopes?: string[]
}

export interface SocialProvidersConfig {
  google?: SocialProviderConfig
  github?: SocialProviderConfig
  // Future providers can be added here
  apple?: SocialProviderConfig
  microsoft?: SocialProviderConfig
  facebook?: SocialProviderConfig
  twitter?: SocialProviderConfig
}

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

export type ImpersonationSession = DbImpersonationSession

// Team member with profile data (used when querying team members with joined profile data)
export interface TeamMemberWithProfile {
  // Base team_member fields
  id?: string // Sometimes included from join
  user_id: string
  team_id: string
  role: string
  joined_at: string
  // Joined profile data (can be named 'profile' or 'profiles' depending on query)
  profile?: Profile | null
  profiles?: Profile | null
  // Optional user reference
  user?: {
    id: string
    email: string
  }
}

// Impersonated user info
export interface ImpersonatedUser {
  id: string
  email: string
  full_name?: string
  role: string
  team?: {
    id: string
    name: string
  }
}

export interface TeamAuthState {
  currentUser: Ref<User | null>
  currentTeam: Ref<Team | null>
  currentRole: Ref<string | null>
  currentProfile: ComputedRef<Profile | null>
  teamMembers: ComputedRef<TeamMemberWithProfile[]>
  impersonatedUser: ComputedRef<ImpersonatedUser | null>
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
  refreshAuthState: () => Promise<void>
}

export type TeamAuth = TeamAuthState & TeamAuthMethods

// UserButton Custom Menu Item Types
export interface CustomMenuItem {
  /** Display text for the menu item */
  label: string
  /** Icon name (e.g., 'i-lucide-settings') */
  icon?: string
  /** Internal route to navigate to */
  to?: string
  /** External URL to navigate to */
  href?: string
  /** Link target (e.g., '_blank') */
  target?: string
  /** Custom click handler (overrides navigation) */
  onSelect?: (event: Event) => void
  /** Disable the menu item */
  disabled?: boolean
  /** Required role to show this item */
  requiredRole?: 'member' | 'admin' | 'owner' | 'super_admin'
  /** Add a separator after this item */
  addSeparator?: boolean
}

// Module Configuration Types
export interface TeamAuthModuleConfig {
  supabaseUrl?: string
  supabaseKey?: string
  debug?: boolean
  redirectTo?: string
  socialProviders?: SocialProvidersConfig
}

// Note: $teamAuthClient plugin types removed - now using @nuxtjs/supabase's useSupabaseClient()

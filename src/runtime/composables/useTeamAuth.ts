import { ref, computed, triggerRef } from 'vue'
import { $fetch } from 'ofetch'
import type { User, Profile, Team, TeamMember, TeamAuth } from '../types'
import { useSessionSync } from './useSessionSync'
import { useSession } from './useSession'
import { useSupabaseClient } from './useSupabaseComposables'
import { useToast, useState } from '#imports'
// Types - we'll get the actual client and user from @nuxtjs/supabase composables
type SupabaseClient = any
type SupabaseUser = any

interface _TeamAuthError {
  code: string
  message: string
}

interface ImpersonationStorageData {
  targetUser: User
  expiresAt: string
  sessionId: string
}

// Helper function to safely extract error for logging
function getErrorForLogging(error: unknown): any {
  if (error && typeof error === 'object') {
    return error
  }
  return { message: String(error) }
}

// Helper function to create headers with auth token
async function createAuthHeaders(supabaseClient?: any): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  try {
    if (supabaseClient) {
      // Use the provided client directly for auth
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      if (!error && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    }
    else {
      // Fallback to useSession for normal runtime usage
      const { getSession } = useSession()
      const session = await getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    }
  }
  catch (error) {
    console.warn('Failed to get session for auth headers:', error)
  }

  return headers
}

// Global flag to prevent multiple auth listeners
let authListenerRegistered = false

// Cache the Supabase client to avoid repeated calls
let cachedClient: any = null

// Reset cached client for testing
export function resetTeamAuthState() {
  cachedClient = null
}

const IMPERSONATION_STORAGE_KEY = 'team_auth_impersonation'

// Load impersonation data from localStorage
const loadImpersonationFromStorage = () => {
  if (!import.meta.client) return {}

  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      // Check if not expired
      if (new Date(data.expiresAt) > new Date()) {
        return {
          impersonating: true,
          impersonatedUser: data.targetUser,
          impersonationExpiresAt: new Date(data.expiresAt),
          impersonationSessionId: data.sessionId,
        }
      }
      else {
        // Clean up expired data
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
      }
    }
  }
  catch (error) {
    console.error('Failed to load impersonation data:', getErrorForLogging(error))
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
  }

  return {}
}

// Save impersonation data to localStorage
const saveImpersonationToStorage = (data: ImpersonationStorageData) => {
  if (!import.meta.client) return

  try {
    const storageData = {
      sessionId: data.impersonationSessionId,
      targetUser: data.impersonatedUser,
      expiresAt: data.impersonationExpiresAt?.toISOString(),
    }
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(storageData))
  }
  catch (error) {
    console.error('Failed to save impersonation data:', getErrorForLogging(error))
  }
}

// Clean initial state with localStorage persistence for impersonation
const createInitialAuthState = () => {
  const impersonationState = loadImpersonationFromStorage()

  return {
    // Core auth
    user: null as User | null,
    profile: null as Profile | null,
    team: null as Team | null,
    role: null as string | null,
    teamMembers: [] as TeamMember[],

    // Impersonation state (unified here) - restored from localStorage
    impersonating: impersonationState.impersonating || false,
    impersonatedUser: impersonationState.impersonatedUser || null,
    impersonationExpiresAt: impersonationState.impersonationExpiresAt || null,
    originalUser: null as User | null, // Store the super admin
    impersonationSessionId: impersonationState.impersonationSessionId || null,
    justStartedImpersonation: false, // UI flag for modal dismissal
    stoppingImpersonation: false, // Flag to indicate stopping in progress

    // State management
    loading: true,
    initialized: false,
  }
}

export function useTeamAuth(injectedClient?: SupabaseClient): TeamAuth {
  // Clean unified auth state using useState
  const authState = useState('team-auth', () => createInitialAuthState())

  // Simple immediate state update with localStorage persistence for impersonation
  const updateAuthState = (updates: Partial<typeof authState.value>) => {
    authState.value = { ...authState.value, ...updates }

    // Save to localStorage if impersonation state changed
    if ('impersonating' in updates || 'impersonatedUser' in updates || 'impersonationSessionId' in updates) {
      if (authState.value.impersonating) {
        saveImpersonationToStorage(authState.value)
      }
      else {
        // Clear localStorage when impersonation ends
        if (import.meta.client) {
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
        }
      }
    }
  }

  // Extract reactive refs from state for compatibility
  const currentUser = computed(() => authState.value.user)
  const currentProfile = computed(() => authState.value.profile)
  const currentTeam = computed(() => authState.value.team)
  const currentRole = computed(() => authState.value.role)
  const teamMembers = computed(() => authState.value.teamMembers)
  const isLoading = computed(() => authState.value.loading)
  const isImpersonating = computed(() => authState.value.impersonating)
  const impersonationExpiresAt = computed(() => authState.value.impersonationExpiresAt)

  // Impersonation-specific computed properties
  const impersonatedUser = computed(() => authState.value.impersonatedUser)
  const originalUser = computed(() => authState.value.originalUser)
  const justStartedImpersonation = computed(() => authState.value.justStartedImpersonation)

  // Session sync utilities
  const sessionSync = useSessionSync()

  // Supabase client initialization - using @nuxtjs/supabase
  const getSupabaseClient = (): SupabaseClient => {
    if (injectedClient) return injectedClient

    // Use our wrapper composable (works in published modules)
    return useSupabaseClient()
  }

  // Lazy client access - only get when needed and only on client
  const getClient = () => {
    if (import.meta.server) {
      throw new Error('Supabase client not available during SSR')
    }
    if (!cachedClient) {
      cachedClient = getSupabaseClient()
    }
    return cachedClient
  }

  // Update complete auth state atomically using updateAuthState helper
  const updateCompleteAuthState = async (user: SupabaseUser) => {
    try {
      // For impersonation scenarios, immediately update with user data
      // and use data from impersonation response to avoid hanging queries
      if (authState.value.impersonating && authState.value.impersonatedUser) {
        const impersonatedData = authState.value.impersonatedUser
        updateAuthState({
          user: {
            id: user.id,
            email: user.email!,
            user_metadata: user.user_metadata,
          },
          profile: {
            id: impersonatedData.id,
            full_name: impersonatedData.full_name,
            email: impersonatedData.email,
          } as User,
          team: impersonatedData.team
            ? {
                id: impersonatedData.team.id,
                name: impersonatedData.team.name,
              } as Team
            : null,
          role: impersonatedData.role,
          loading: false,
        })
        return
      }

      // For stopping impersonation, immediately update with minimal data
      // and skip database queries that might hang during session switch
      if (authState.value.stoppingImpersonation) {
        updateAuthState({
          user: {
            id: user.id,
            email: user.email!,
            user_metadata: user.user_metadata,
          },
          profile: null, // Will be populated by background refresh if needed
          team: null, // Will be populated by background refresh if needed
          role: null, // Will be populated by background refresh if needed
          stoppingImpersonation: false, // Clear the flag
          loading: false,
        })
        return
      }

      try {
      // Fetch all data in parallel for normal (non-impersonation) scenarios
        const [profileResult, teamResult] = await Promise.all([
          getClient()
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),

          getClient()
            .from('team_members')
            .select(`
            role,
            teams!inner (
              id, name, created_at, company_name,
              company_address_line1, company_address_line2,
              company_city, company_state, company_postal_code,
              company_country, company_vat_number
            )
          `)
            .eq('user_id', user.id)
            .single(),
        ])

        // Use updateAuthState for immediate, consistent updates
        updateAuthState({
          user: {
            id: user.id,
            email: user.email!,
            user_metadata: user.user_metadata,
          },
          profile: profileResult.data || null,
          team: teamResult.data
            ? {
                id: teamResult.data.teams.id,
                name: teamResult.data.teams.name,
                created_at: teamResult.data.teams.created_at,
                company_name: teamResult.data.teams.company_name,
                company_address_line1: teamResult.data.teams.company_address_line1,
                company_address_line2: teamResult.data.teams.company_address_line2,
                company_city: teamResult.data.teams.company_city,
                company_state: teamResult.data.teams.company_state,
                company_postal_code: teamResult.data.teams.company_postal_code,
                company_country: teamResult.data.teams.company_country,
                company_vat_number: teamResult.data.teams.company_vat_number,
              }
            : null,
          role: teamResult.data?.role || null,
          loading: false,
        })
      }
      catch (error) {
        console.error('Failed to update auth state:', getErrorForLogging(error))
        // Update with partial data using same helper
        updateAuthState({
          user: {
            id: user.id,
            email: user.email!,
            user_metadata: user.user_metadata,
          },
          profile: null,
          team: null,
          role: null,
          loading: false,
        })
      }
    }
    catch (outerError) {
      console.error('Auth state update failed:', getErrorForLogging(outerError))
    }
  }

  // Reset auth state
  const resetAuthState = () => {
    authState.value = {
      ...authState.value,
      user: null,
      profile: null,
      team: null,
      role: null,
      impersonating: false,
      impersonationExpiresAt: null,
      loading: false,
    }
  }

  // Deduplication for concurrent auth updates
  const lastProcessedEvent = ref<string>('')

  // Initialize auth state once
  const initializeAuth = async () => {
    if (authState.value.initialized) {
      return
    }

    try {
      // Get initial session
      const { data: { session } } = await getClient().auth.getSession()

      if (session?.user) {
        await updateCompleteAuthState(session.user)
      }
      else {
        // No active session - clear any stale impersonation state
        if (authState.value.impersonating) {
          if (import.meta.client) {
            localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
          }
          authState.value = {
            ...createInitialAuthState(),
            impersonating: false,
            impersonatedUser: null,
            impersonationExpiresAt: null,
            impersonationSessionId: null,
            loading: false,
            initialized: false,
          }
        }
        else {
          authState.value = { ...authState.value, loading: false }
        }
      }

      // Setup auth listener once globally
      if (!authListenerRegistered) {
        authListenerRegistered = true

        getClient().auth.onAuthStateChange(async (event, session) => {
          // Deduplicate events
          const eventKey = `${event}:${session?.user?.id || 'none'}:${session?.user?.email || 'none'}`
          if (lastProcessedEvent.value === eventKey) {
            return
          }
          lastProcessedEvent.value = eventKey

          switch (event) {
            case 'SIGNED_IN':
            case 'TOKEN_REFRESHED':
            case 'USER_UPDATED':
              if (session?.user) {
                await updateCompleteAuthState(session.user)
              }
              break

            case 'SIGNED_OUT':
              resetAuthState()
              lastProcessedEvent.value = '' // Reset on signout
              break
          }
        })
      }

      authState.value.initialized = true
    }
    catch (error) {
      console.error('Auth initialization failed:', getErrorForLogging(error))
      authState.value = { ...authState.value, loading: false }
    }
  }

  // Initialize on client-side only
  if (import.meta.client && !authState.value.initialized) {
    initializeAuth()
  }

  return {
    // State
    currentUser,
    currentProfile,
    currentTeam,
    currentRole,
    teamMembers,
    isLoading,
    isImpersonating,
    impersonationExpiresAt,
    impersonatedUser,
    originalUser,
    justStartedImpersonation,

    // Authentication methods
    signUpWithTeam: async (email: string, password: string, teamName: string): Promise<void> => {
      try {
        authState.value = { ...authState.value, loading: true }

        // Call Edge Function to create user and team in one transaction
        const response = await $fetch('/api/signup-with-team', {
          method: 'POST',
          body: {
            email,
            password,
            teamName,
          },
        })

        if (!response.success) {
          throw { code: 'SIGNUP_FAILED', message: response.message || 'Signup failed' }
        }

        // Sign in the user after successful creation
        const { error: signInError } = await getClient().auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw { code: 'SIGNIN_AFTER_SIGNUP_FAILED', message: signInError.message }
        }

        // State will be updated by the auth listener
      }
      catch (error: unknown) {
        console.error('Sign up with team failed:', getErrorForLogging(error))
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    signIn: async (email: string, password: string): Promise<void> => {
      try {
        authState.value = { ...authState.value, loading: true }

        const { data: _data, error } = await getClient().auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw { code: 'SIGNIN_FAILED', message: error.message }
        }

        // State will be updated by the auth listener
      }
      catch (error: unknown) {
        console.error('Sign in failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    signOut: async (): Promise<void> => {
      try {
        authState.value = { ...authState.value, loading: true }
        await getClient().auth.signOut()
        // State will be reset by the auth listener
      }
      catch (error) {
        console.error('Sign out failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    // Profile methods
    getProfile: async (): Promise<Profile | null> => {
      if (!currentUser.value) return null

      const { data, error } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', currentUser.value.id)
        .single()

      if (error) {
        console.error('Failed to fetch profile:', error)
        return null
      }

      return data
    },

    updateProfile: async (updates: Partial<Profile>): Promise<void> => {
      if (!currentUser.value) {
        throw new Error('No authenticated user')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Handle password update separately if provided
        if ('password' in updates && updates.password) {
          const { error: passwordError } = await getClient().auth.updateUser({
            password: updates.password,
          })

          if (passwordError) {
            throw { code: 'PASSWORD_UPDATE_FAILED', message: passwordError.message }
          }

          // Remove password from profile updates
          const { password: _, ...profileUpdates } = updates
          updates = profileUpdates
        }

        // Update profile if there are non-password fields
        if (Object.keys(updates).length > 0) {
          const { data, error } = await getClient()
            .from('profiles')
            .update(updates)
            .eq('id', currentUser.value.id)
            .select()
            .single()

          if (error) {
            throw { code: 'PROFILE_UPDATE_FAILED', message: error.message }
          }

          // Update the reactive state immediately for better UX
          authState.value = {
            ...authState.value,
            profile: { ...authState.value.profile, ...data } as Profile,
          }

          // Force Vue to update refs that depend on profile
          triggerRef(authState)
        }
      }
      catch (error: unknown) {
        console.error('Profile update failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    // Team management methods
    inviteMember: async (email: string, role: string = 'member'): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      // Validate role
      const validRoles = ['member', 'admin']
      if (!validRoles.includes(role)) {
        throw new Error('Invalid role. Must be member or admin')
      }

      // Check if we have a current team
      if (!currentTeam.value?.id) {
        throw new Error('No team selected')
      }

      // Check permissions - only admin and owner can invite
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to invite members')
      }

      try {
        console.log('invite: step 1 - setting loading state')
        authState.value = { ...authState.value, loading: true }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        try {
          console.log('invite: step 2 - getting session')
          // Use direct Supabase client instead of useSession which might be hanging
          const { data: { session }, error: sessionError } = await getClient().auth.getSession()
          if (sessionError) {
            console.warn('Session error:', sessionError)
          }
          else if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
          console.log('invite: step 3 - session obtained')
        }
        catch (error) {
          console.warn('Failed to get session for auth headers:', error)
        }

        console.log('invite: step 4 - making API call')
        const response = await $fetch('/api/invite-member', {
          method: 'POST',
          headers,
          body: {
            email,
            role,
            teamId: currentTeam.value.id,
          },
        })

        if (!response.success) {
          throw { code: 'INVITE_FAILED', message: response.message || 'Failed to send invite' }
        }
      }
      catch (error: any) {
        console.error('Invite member failed:', error)
        // Extract error message from various possible sources
        let errorMessage = 'Failed to send invitation'

        if (error?.data?.message) {
          errorMessage = error.data.message
        }
        else if (error?.statusMessage) {
          errorMessage = error.statusMessage
        }
        else if (error?.message) {
          errorMessage = error.message
        }
        else if (error?.data?.error) {
          errorMessage = error.data.error
        }

        throw new Error(errorMessage)
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    getPendingInvitations: async () => {
      // Check role permissions - only owner, admin, or super_admin can view pending invitations
      if (!currentRole.value || !['owner', 'admin', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to view pending invitations')
      }

      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const headers = await createAuthHeaders(getClient())

        // Get pending invitations from auth.users via Edge Function
        const response = await $fetch('/api/get-pending-invitations', {
          method: 'POST',
          headers,
          body: {
            teamId: currentTeam.value.id,
          },
        })

        if (!response.success) {
          throw { code: 'GET_INVITATIONS_FAILED', message: response.message || 'Failed to fetch invitations' }
        }
        return response.invitations || []
      }
      catch (error: unknown) {
        console.error('Get pending invitations failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    revokeInvite: async (userId: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      // Check permissions
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to revoke invites')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const headers = await createAuthHeaders(getClient())

        // Revoke invitation by deleting the unconfirmed user via Edge Function
        const response = await $fetch('/api/revoke-invitation', {
          method: 'POST',
          headers,
          body: {
            userId,
            teamId: currentTeam.value.id,
          },
        })

        if (!response.success) {
          throw { code: 'REVOKE_INVITE_FAILED', message: response.message || 'Failed to revoke invitation' }
        }
      }
      catch (error: unknown) {
        console.error('Revoke invite failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    resendInvite: async (userId: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Get pending invitations from Supabase auth system
        const pendingInvitations = await this.getPendingInvitations()

        // Find the specific invitation by user ID
        const invitation = pendingInvitations.find(inv => inv.id === userId)

        if (!invitation) {
          throw { code: 'INVITE_NOT_FOUND', message: 'Invitation not found' }
        }

        // Revoke the old invitation
        await this.revokeInvite(userId)

        // Create a new invitation using the invite member method
        // Extract role from user metadata or default to 'member'
        const role = invitation.user_metadata?.team_role || 'member'
        await this.inviteMember(invitation.email, role)
      }
      catch (error: unknown) {
        console.error('Resend invite failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    promote: async (userId: string): Promise<void> => {
      if (!currentRole.value || currentRole.value !== 'owner') {
        throw new Error('Only team owners can promote members')
      }
      await this.updateMemberRole(userId, 'admin')
    },

    demote: async (userId: string): Promise<void> => {
      if (!currentRole.value || !['admin', 'owner'].includes(currentRole.value)) {
        throw new Error('You do not have permission to demote members')
      }
      await this.updateMemberRole(userId, 'member')
    },

    transferOwnership: async (userId: string): Promise<void> => {
      if (!currentTeam.value || !currentUser.value) {
        throw new Error('No current team or user available')
      }

      if (currentRole.value !== 'owner') {
        throw new Error('Only the current owner can transfer ownership')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const headers = await createAuthHeaders(getClient())

        const response = await $fetch('/api/transfer-ownership', {
          method: 'POST',
          headers,
          body: {
            teamId: currentTeam.value.id,
            newOwnerId: userId,
          },
        })

        if (!response.success) {
          throw { code: 'TRANSFER_FAILED', message: response.message || 'Failed to transfer ownership' }
        }

        // Update current user's role to admin
        authState.value = {
          ...authState.value,
          role: 'admin',
        }

        // Refresh team members to show updated roles
        await this.getTeamMembers()
      }
      catch (error: unknown) {
        console.error('Transfer ownership failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    renameTeam: async (name: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      if (currentRole.value !== 'owner') {
        throw new Error('Only team owners can rename the team')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const { data: _data, error } = await getClient()
          .from('teams')
          .update({ name })
          .eq('id', currentTeam.value.id)
          .select()
          .single()

        if (error) {
          throw { code: 'RENAME_TEAM_FAILED', message: error.message }
        }

        // Update the reactive state immediately
        authState.value = {
          ...authState.value,
          team: { ...authState.value.team!, name },
        }
      }
      catch (error: unknown) {
        console.error('Rename team failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    updateTeam: async (updates: Partial<Team>): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      if (currentRole.value !== 'owner') {
        throw new Error('Only team owners can update team settings')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const { data, error } = await getClient()
          .from('teams')
          .update(updates)
          .eq('id', currentTeam.value.id)
          .select()
          .single()

        if (error) {
          throw { code: 'UPDATE_TEAM_FAILED', message: error.message }
        }

        // Update the reactive state immediately
        authState.value = {
          ...authState.value,
          team: { ...authState.value.team!, ...data },
        }
      }
      catch (error: unknown) {
        console.error('Update team failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    deleteTeam: async (): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      if (currentRole.value !== 'owner') {
        throw new Error('Only team owners can delete the team')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Use the comprehensive delete-team Edge Function
        const headers = await createAuthHeaders()
        const response = await fetch(`${process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-team`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            team_id: currentTeam.value.id,
            confirm_deletion: true,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw {
            code: errorData.error || 'DELETE_TEAM_FAILED',
            message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          }
        }

        const result = await response.json()

        // Log deletion summary for debugging
        if (result.members_removed > 0) {
          console.log(`Team deletion completed: ${result.members_removed} members removed, team "${result.deleted_team.name}" deleted`)
        }

        // Reset team-related state
        authState.value = {
          ...authState.value,
          team: null,
          role: null,
          teamMembers: [],
        }
      }
      catch (error: unknown) {
        console.error('Delete team failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    // Team member methods
    getTeamMembers: async () => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      const { data: session } = await getClient().auth.getSession()
      if (!session.session) {
        throw new Error('No active session - please log in')
      }

      const { data: members, error } = await getClient()
        .from('team_members')
        .select(`
          user_id,
          role,
          joined_at,
          profiles!inner (
            id,
            full_name,
            email
          )
        `)
        .eq('team_id', currentTeam.value.id)

      if (error) {
        throw new Error(`Failed to load team members: ${error.message}`)
      }

      const mappedMembers = (members || []).map(member => ({
        id: member.user_id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        user: {
          email: member.profiles.email,
        },
        profile: member.profiles,
      }))

      authState.value = { ...authState.value, teamMembers: mappedMembers }
      return mappedMembers
    },

    updateMemberRole: async (userId: string, newRole: string) => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      const validRoles = ['member', 'admin', 'owner']
      if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role')
      }

      // Check permissions
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to update member roles')
      }

      // Only owners can promote to admin or change ownership
      if (newRole === 'admin' && currentRole.value !== 'owner') {
        throw new Error('Only owners can promote members to admin')
      }

      if (newRole === 'owner') {
        throw new Error('Use transferOwnership method to change team ownership')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const { error } = await getClient()
          .from('team_members')
          .update({ role: newRole })
          .eq('team_id', currentTeam.value.id)
          .eq('user_id', userId)

        if (error) {
          throw { code: 'UPDATE_ROLE_FAILED', message: error.message }
        }

        // Update the reactive state immediately
        const updatedMembers = authState.value.teamMembers.map(member =>
          member.user_id === userId ? { ...member, role: newRole } : member,
        )

        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers,
        }
      }
      catch (error: unknown) {
        console.error('Update member role failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    removeMember: async (userId: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      // Check permissions
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to remove members')
      }

      // Prevent owner from removing themselves
      if (userId === currentUser.value?.id && currentRole.value === 'owner') {
        throw new Error('Team owner cannot remove themselves. Transfer ownership first.')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Delete the user account - this will cascade to profiles and team_members
        const headers = await createAuthHeaders()
        const response = await $fetch('/api/delete-user', {
          method: 'POST',
          headers,
          body: { userId },
        })

        if (!response.success) {
          throw { code: 'DELETE_USER_FAILED', message: response.error || 'Failed to delete user' }
        }

        // Update the reactive state immediately
        const updatedMembers = authState.value.teamMembers.filter(member => member.user_id !== userId)
        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers,
        }
      }
      catch (error: unknown) {
        console.error('Remove member failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    getTeamMemberProfile: async (userId: string): Promise<Profile | null> => {
      // Only admin, owner, or super_admin can view other profiles
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to view member profiles')
      }

      const { data, error } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Failed to fetch team member profile:', error)
        return null
      }

      return data
    },

    updateTeamMemberProfile: async (userId: string, updates: Partial<Profile>): Promise<void> => {
      // Only admin, owner, or super_admin can edit other profiles
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to edit member profiles')
      }

      // Prevent editing own profile through this method
      if (userId === currentUser.value?.id) {
        throw new Error('Use updateProfile method to edit your own profile')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Only allow certain fields to be updated by admins
        const allowedFields = ['full_name', 'phone', 'company_role']
        const filteredUpdates = Object.keys(updates)
          .filter(key => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updates[key]
            return obj
          }, {} as Partial<Profile>)

        if (Object.keys(filteredUpdates).length === 0) {
          throw new Error('No valid fields to update')
        }

        const { error } = await getClient()
          .from('profiles')
          .update(filteredUpdates)
          .eq('id', userId)

        if (error) {
          throw { code: 'UPDATE_MEMBER_PROFILE_FAILED', message: error.message }
        }

        // Update the member in the team members list if they exist
        const updatedMembers = authState.value.teamMembers.map((member) => {
          if (member.user_id === userId) {
            return {
              ...member,
              profile: { ...member.profile, ...filteredUpdates },
            }
          }
          return member
        })

        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers,
        }
      }
      catch (error: unknown) {
        console.error('Update team member profile failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    // Utility methods
    getAvatarFallback: (overrides?: {
      fullName?: string | null
      email?: string | null
    }): string => {
      const fullName = overrides?.fullName !== undefined
        ? overrides.fullName
        : currentUser.value?.user_metadata?.name

      const email = overrides?.email !== undefined
        ? overrides.email
        : currentUser.value?.email

      if (fullName && fullName.trim()) {
        return fullName
          .trim()
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      }

      if (email) {
        return email[0].toUpperCase()
      }

      return 'U'
    },

    // Unified impersonation methods (no delegation)
    startImpersonation: async (targetUserId: string, reason: string): Promise<void> => {
      try {
        updateAuthState({ loading: true })

        // Store original user before impersonation
        const originalUser = currentUser.value
        if (!originalUser) {
          throw new Error('No authenticated user to start impersonation from')
        }

        // Get current session for API authentication
        const { data: { session } } = await getClient().auth.getSession()
        if (!session) {
          throw new Error('No active session')
        }

        // Call impersonation API
        const response = await $fetch('/api/impersonate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { targetUserId, reason },
        })

        if (!response.success) {
          throw new Error(response.message || 'Failed to start impersonation')
        }

        // IMMEDIATE state update (like useImpersonation pattern)
        // Note: No longer storing admin tokens - server handles restoration via JWT cookie + magic link
        updateAuthState({
          // Keep current user for now, auth listener will update it
          originalUser,
          impersonating: true,
          impersonatedUser: response.impersonation.target_user,
          impersonationExpiresAt: new Date(response.impersonation.expires_at),
          impersonationSessionId: response.impersonation.session_id,
          loading: false,
        })

        // Show success toast
        const toast = useToast()
        toast.add({
          title: 'Impersonation Started',
          description: `Now impersonating ${response.impersonation.target_user.full_name || response.impersonation.target_user.email}`,
          color: 'blue',
          icon: 'i-lucide-user-check',
        })

        // Signal that impersonation just started (for modal dismissal)
        authState.value = { ...authState.value, justStartedImpersonation: true }

        // Set the new session (auth listener will handle the rest)
        await getClient().auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        })
      }
      catch (error: unknown) {
        console.error('Start impersonation failed:', error)
        updateAuthState({ loading: false })

        // Show error toast
        const toast = useToast()
        toast.add({
          title: 'Impersonation Failed',
          description: error.data?.message || error.message || 'Failed to start impersonation',
          color: 'red',
          icon: 'i-lucide-alert-circle',
        })

        throw error
      }
    },

    stopImpersonation: async (): Promise<void> => {
      try {
        updateAuthState({ loading: true })

        if (!isImpersonating.value || !authState.value.impersonationSessionId) {
          throw new Error('No active impersonation session')
        }

        // Call stop impersonation API
        const { data: { session } } = await getClient().auth.getSession()
        if (!session) {
          // No active session - just clear local state
          updateAuthState({
            impersonating: false,
            impersonatedUser: null,
            impersonationExpiresAt: null,
            impersonationSessionId: null,
            originalUser: null,
            loading: false,
          })

          const toast = useToast()
          toast.add({
            title: 'Impersonation Cleared',
            description: 'Stale impersonation state has been cleared',
            color: 'green',
            icon: 'i-lucide-user-x',
          })

          return
        }

        // Call stop impersonation API - server handles admin session restoration via magic link
        const response = await $fetch('/api/stop-impersonation', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            sessionId: authState.value.impersonationSessionId,
          },
        })

        // Set flag to indicate we're stopping impersonation
        updateAuthState({
          stoppingImpersonation: true,
        })

        // IMMEDIATE state reset (like useImpersonation pattern)
        updateAuthState({
          impersonating: false,
          impersonatedUser: null,
          impersonationExpiresAt: null,
          impersonationSessionId: null,
          originalUser: null,
          loading: false,
        })

        // Server provides restored admin session via magic link approach
        if (response.session) {
          try {
            await getClient().auth.setSession({
              access_token: response.session.access_token,
              refresh_token: response.session.refresh_token,
            })

            // Schedule a role refresh after session is stable
            // This ensures UserButton menu items update properly
            setTimeout(async () => {
              try {
                const { data: { session } } = await getClient().auth.getSession()
                if (session?.user) {
                  await updateCompleteAuthState(session.user)
                }
              }
              catch (error) {
                console.warn('Failed to refresh auth state after impersonation end:', error)
              }
            }, 100)
          }
          catch (error) {
            console.warn('Failed to restore admin session:', error)
            // Clear the flag on error - auth listener will handle the state
            updateAuthState({ stoppingImpersonation: false })
          }
        }

        // Show success toast
        const toast = useToast()
        toast.add({
          title: 'Impersonation Ended',
          description: 'Returned to your original session',
          color: 'green',
          icon: 'i-lucide-user-x',
        })
      }
      catch (error: unknown) {
        console.error('Stop impersonation failed:', error)
        updateAuthState({ loading: false })

        // Show error toast
        const toast = useToast()
        toast.add({
          title: 'Error Stopping Impersonation',
          description: 'Session has been cleared. Please sign in again.',
          color: 'red',
          icon: 'i-lucide-alert-circle',
        })

        throw error
      }
    },

    // Session management utilities
    sessionHealth: () => sessionSync.performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    triggerSessionRecovery: () => sessionSync.triggerSessionRecovery(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    getActiveTabs: sessionSync.getActiveTabs,
    isTabPrimary: sessionSync.isPrimaryTab,

    // Testing utilities
    $initializationPromise: Promise.resolve(),

    // Force refresh auth state
    refreshAuthState: async () => {
      if (currentUser.value) {
        await updateCompleteAuthState(currentUser.value as SupabaseUser)
      }
    },

    // Clear success flag for UI components
    clearSuccessFlag: () => {
      authState.value = { ...authState.value, justStartedImpersonation: false }
    },
  }
}

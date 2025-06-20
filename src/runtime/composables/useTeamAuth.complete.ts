import { ref, reactive, computed, watch, onMounted, onUnmounted, getCurrentInstance, triggerRef } from 'vue'
import type { Ref } from 'vue'
import type { SupabaseClient, AuthSession, User as SupabaseUser, AuthChangeEvent } from '@supabase/supabase-js'
import type { User, Profile, Team, TeamMember, TeamAuth, TeamAuthState } from '../types'
import { useSessionSync } from './useSessionSync'

interface TeamAuthError {
  code: string
  message: string
}

export function useTeamAuth(injectedClient?: SupabaseClient): TeamAuth {
  // Single auth state using useState - called inside the composable function
  const authState = useState('team-auth', () => ({
    user: null as User | null,
    profile: null as Profile | null,
    team: null as Team | null,
    role: null as string | null,
    teamMembers: [] as TeamMember[],
    loading: true,
    impersonating: false,
    impersonationExpiresAt: null as Date | null,
    initialized: false
  }))

  // Extract reactive refs from state for compatibility
  const currentUser = computed(() => authState.value.user)
  const currentProfile = computed(() => authState.value.profile) 
  const currentTeam = computed(() => authState.value.team)
  const currentRole = computed(() => authState.value.role)
  const teamMembers = computed(() => authState.value.teamMembers)
  const isLoading = computed(() => authState.value.loading)
  const isImpersonating = computed(() => authState.value.impersonating)
  const impersonationExpiresAt = computed(() => authState.value.impersonationExpiresAt)

  // Session sync utilities
  const sessionSync = useSessionSync()

  // Supabase client initialization - for client-only usage
  const getSupabaseClient = (): SupabaseClient => {
    if (injectedClient) return injectedClient

    const nuxtApp = useNuxtApp()
    if (!nuxtApp?.$teamAuthClient) {
      throw new Error('Supabase client not available. Ensure auth components are wrapped in <ClientOnly>')
    }
    return nuxtApp.$teamAuthClient as SupabaseClient
  }

  // Lazy client access - only get when needed and only on client
  const getClient = () => {
    if (process.server) {
      throw new Error('Supabase client not available during SSR')
    }
    return getSupabaseClient()
  }

  // Update complete auth state atomically
  const updateCompleteAuthState = async (user: SupabaseUser) => {
    console.log(`🔥 Updating complete auth state for: ${user.email}`)
    
    try {
      // Fetch all data in parallel
      const [profileResult, teamResult] = await Promise.all([
        // Fetch profile
        getClient()
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        
        // Fetch team membership  
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
          .single()
      ])

      // Update entire state atomically
      authState.value = {
        ...authState.value,
        user: {
          id: user.id,
          email: user.email!,
          user_metadata: user.user_metadata,
        },
        profile: profileResult.data || null,
        team: teamResult.data ? {
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
        } : null,
        role: teamResult.data?.role || null,
        loading: false
      }
      
      console.log(`🔥 Auth state updated - User: ${user.email}, Team: ${authState.value.team?.name}, Role: ${authState.value.role}`)
      
    } catch (error) {
      console.error('🔥 Failed to update auth state:', error)
      // Update with partial data
      authState.value = {
        ...authState.value,
        user: {
          id: user.id,
          email: user.email!,
          user_metadata: user.user_metadata,
        },
        profile: null,
        team: null,
        role: null,
        loading: false
      }
    }
  }

  // Reset auth state
  const resetAuthState = () => {
    console.log('🔥 Resetting auth state')
    authState.value = {
      ...authState.value,
      user: null,
      profile: null,
      team: null,
      role: null,
      impersonating: false,
      impersonationExpiresAt: null,
      loading: false
    }
  }

  // Initialize auth state once
  const initializeAuth = async () => {
    if (authState.value.initialized) {
      console.log('🔥 Auth already initialized, skipping')
      return
    }
    
    console.log('🔥 Initializing auth state')
    
    try {
      // Get initial session
      const { data: { session } } = await getClient().auth.getSession()
      
      if (session?.user) {
        await updateCompleteAuthState(session.user)
      } else {
        authState.value = { ...authState.value, loading: false }
      }
      
      // Setup auth listener once
      getClient().auth.onAuthStateChange(async (event, session) => {
        console.log(`🔥 Auth event: ${event} | User: ${session?.user?.email || 'none'}`)
        
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
            break
        }
      })
      
      authState.value.initialized = true
      console.log('🔥 Auth initialization complete')
      
    } catch (error) {
      console.error('🔥 Auth initialization failed:', error)
      authState.value = { ...authState.value, loading: false }
    }
  }

  // Initialize on client-side only
  if (process.client && !authState.value.initialized) {
    initializeAuth()
  }

  // Impersonation composable
  const useImpersonationComposable = () => {
    try {
      return useImpersonation()
    } catch (error) {
      // Return mock if not available
      return {
        startImpersonation: async () => { throw new Error('Impersonation not available') },
        stopImpersonation: async () => { throw new Error('Impersonation not available') }
      }
    }
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
      catch (error: any) {
        console.error('Sign up with team failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    signIn: async (email: string, password: string): Promise<void> => {
      try {
        authState.value = { ...authState.value, loading: true }

        const { data, error } = await getClient().auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw { code: 'SIGNIN_FAILED', message: error.message }
        }

        // State will be updated by the auth listener
      }
      catch (error: any) {
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
            password: updates.password
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
            profile: { ...authState.value.profile, ...data } as Profile
          }

          // Force Vue to update refs that depend on profile
          triggerRef(authState)
        }
      }
      catch (error: any) {
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

      // Check permissions - only admin and owner can invite
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to invite members')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const response = await $fetch('/api/invite-member', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    revokeInvite: async (inviteId: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      // Check permissions
      if (!currentRole.value || !['admin', 'owner', 'super_admin'].includes(currentRole.value)) {
        throw new Error('You do not have permission to revoke invites')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        const { error } = await getClient()
          .from('invites')
          .update({ status: 'revoked' })
          .eq('id', inviteId)
          .eq('team_id', currentTeam.value.id)

        if (error) {
          throw { code: 'REVOKE_INVITE_FAILED', message: error.message }
        }
      }
      catch (error: any) {
        console.error('Revoke invite failed:', error)
        throw error
      }
      finally {
        authState.value = { ...authState.value, loading: false }
      }
    },

    resendInvite: async (inviteId: string): Promise<void> => {
      if (!currentTeam.value) {
        throw new Error('No current team available')
      }

      try {
        authState.value = { ...authState.value, loading: true }

        // Get the original invite
        const { data: invite, error: fetchError } = await getClient()
          .from('invites')
          .select('email, role')
          .eq('id', inviteId)
          .eq('team_id', currentTeam.value.id)
          .single()

        if (fetchError || !invite) {
          throw { code: 'INVITE_NOT_FOUND', message: 'Invite not found' }
        }

        // Delete the old invite
        const { error: deleteError } = await getClient()
          .from('invites')
          .delete()
          .eq('id', inviteId)

        if (deleteError) {
          throw { code: 'DELETE_INVITE_FAILED', message: deleteError.message }
        }

        // Create a new invite using the invite member method
        await this.inviteMember(invite.email, invite.role)
      }
      catch (error: any) {
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

        const response = await $fetch('/api/transfer-ownership', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
          role: 'admin'
        }

        // Refresh team members to show updated roles
        await this.getTeamMembers()
      }
      catch (error: any) {
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

        const { data, error } = await getClient()
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
          team: { ...authState.value.team!, name }
        }
      }
      catch (error: any) {
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
          team: { ...authState.value.team!, ...data }
        }
      }
      catch (error: any) {
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

        // Check if there are other members
        const { data: members, error: membersError } = await getClient()
          .from('team_members')
          .select('user_id')
          .eq('team_id', currentTeam.value.id)
          .neq('user_id', currentUser.value?.id)

        if (membersError) {
          throw { code: 'CHECK_MEMBERS_FAILED', message: membersError.message }
        }

        if (members && members.length > 0) {
          throw { code: 'TEAM_HAS_MEMBERS', message: 'Cannot delete team with other members. Remove all members first.' }
        }

        // Delete the team
        const { error } = await getClient()
          .from('teams')
          .delete()
          .eq('id', currentTeam.value.id)

        if (error) {
          throw { code: 'DELETE_TEAM_FAILED', message: error.message }
        }

        // Reset team-related state
        authState.value = {
          ...authState.value,
          team: null,
          role: null,
          teamMembers: []
        }
      }
      catch (error: any) {
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
          member.user_id === userId ? { ...member, role: newRole } : member
        )

        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        }
      }
      catch (error: any) {
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

        const { error } = await getClient()
          .from('team_members')
          .delete()
          .eq('team_id', currentTeam.value.id)
          .eq('user_id', userId)

        if (error) {
          throw { code: 'REMOVE_MEMBER_FAILED', message: error.message }
        }

        // Update the reactive state immediately
        const updatedMembers = authState.value.teamMembers.filter(member => member.user_id !== userId)
        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        }
      }
      catch (error: any) {
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
        const updatedMembers = authState.value.teamMembers.map(member => {
          if (member.user_id === userId) {
            return {
              ...member,
              profile: { ...member.profile, ...filteredUpdates }
            }
          }
          return member
        })

        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        }
      }
      catch (error: any) {
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

    // Impersonation methods (delegate to useImpersonation)
    startImpersonation: async (targetUserId: string, reason: string): Promise<void> => {
      const impersonation = useImpersonationComposable()
      return impersonation.startImpersonation(targetUserId, reason)
    },

    stopImpersonation: async (): Promise<void> => {
      const impersonation = useImpersonationComposable()
      return impersonation.stopImpersonation()
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
        await updateCompleteAuthState(currentUser.value as any)
      }
    },
  }
}
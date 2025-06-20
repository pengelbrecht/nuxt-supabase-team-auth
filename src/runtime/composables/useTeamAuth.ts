import { ref, reactive, computed, watch, onMounted, onUnmounted, getCurrentInstance, triggerRef } from 'vue'
import type { Ref } from 'vue'
import type { SupabaseClient, AuthSession, User as SupabaseUser } from '@supabase/supabase-js'
import type { User, Profile, Team, TeamMember, TeamAuth, TeamAuthState } from '../types'
import { useSessionSync } from './useSessionSync'

interface TeamAuthError {
  code: string
  message: string
}

// Global reactive state - shared across all components
const globalState = {
  currentUser: ref<User | null>(null),
  currentProfile: ref<Profile | null>(null),
  currentTeam: ref<Team | null>(null),
  currentRole: ref<string | null>(null),
  teamMembers: ref<TeamMember[]>([]),
  isLoading: ref(true),
  isImpersonating: ref(false),
  impersonationExpiresAt: ref<Date | null>(null),
}

export function useTeamAuth(injectedClient?: SupabaseClient): TeamAuth {
  // Use global reactive state
  const currentUser = globalState.currentUser
  const currentProfile = globalState.currentProfile
  const currentTeam = globalState.currentTeam
  const currentRole = globalState.currentRole
  const teamMembers = globalState.teamMembers
  const isLoading = globalState.isLoading
  const isImpersonating = globalState.isImpersonating
  const impersonationExpiresAt = globalState.impersonationExpiresAt

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


  // Update state from session
  let isUpdating = false
  
  const updateStateFromSession = async (session: AuthSession) => {
    const user = session.user
    
    // Prevent concurrent execution
    if (isUpdating) {
      return
    }
    
    // Skip if user hasn't changed
    if (currentUser.value?.id === user.id) {
      return
    }
    
    isUpdating = true
    
    try {

    // Set current user
    currentUser.value = {
      id: user.id,
      email: user.email!,
      user_metadata: user.user_metadata,
    }

    // Fetch team information from database
    try {
      const { data: teamMember, error } = await getClient()
        .from('team_members')
        .select(`
          role,
          teams (
            id,
            name,
            created_at,
            company_name,
            company_address_line1,
            company_address_line2,
            company_city,
            company_state,
            company_postal_code,
            company_country,
            company_vat_number
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (!error && teamMember) {
        currentTeam.value = {
          id: teamMember.teams.id,
          name: teamMember.teams.name,
          created_at: teamMember.teams.created_at,
          company_name: teamMember.teams.company_name,
          company_address_line1: teamMember.teams.company_address_line1,
          company_address_line2: teamMember.teams.company_address_line2,
          company_city: teamMember.teams.company_city,
          company_state: teamMember.teams.company_state,
          company_postal_code: teamMember.teams.company_postal_code,
          company_country: teamMember.teams.company_country,
          company_vat_number: teamMember.teams.company_vat_number,
        }
        currentRole.value = teamMember.role
      }
      else {
        // No team membership found
        currentTeam.value = null
        currentRole.value = null
      }
    }
    catch (error) {
      console.warn('Failed to fetch team information:', error)
      currentTeam.value = null
      currentRole.value = null
    }

    // Load user profile
    try {
      currentProfile.value = await getProfile()
    }
    catch (error) {
      console.warn('Failed to fetch profile information:', error)
      currentProfile.value = null
    }

    // Reset impersonation state (we're not using JWT claims for this yet)
    isImpersonating.value = false
    impersonationExpiresAt.value = null
    
    } finally {
      isUpdating = false
    }
  }

  // Reset state on sign out
  const resetState = () => {
    currentUser.value = null
    currentProfile.value = null
    currentTeam.value = null
    currentRole.value = null
    isImpersonating.value = false
    impersonationExpiresAt.value = null
  }


  // Authentication methods
  const signUpWithTeam = async (email: string, password: string, teamName: string): Promise<void> => {
    try {
      isLoading.value = true

      // Call Edge Function to create user and team in one transaction
      const { data, error } = await getClient().functions.invoke('create-team-and-owner', {
        body: {
          email,
          password,
          team_name: teamName,
        },
      })

      if (error) {
        throw { code: 'TEAM_CREATION_FAILED', message: error.message }
      }

      if (!data?.success) {
        throw { code: 'TEAM_CREATION_FAILED', message: 'Edge Function returned unsuccessful response' }
      }

      // The Edge Function creates the user and team, now we need to sign in
      const { data: signInData, error: signInError } = await getClient().auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw { code: 'SIGNIN_FAILED', message: signInError.message }
      }

      // State will be updated by the auth listener
    }
    catch (error: any) {
      console.error('Sign up with team failed:', error)
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      isLoading.value = true

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
      isLoading.value = false
    }
  }

  const signOut = async (): Promise<void> => {
    try {
      isLoading.value = true

      const { error } = await getClient().auth.signOut()

      if (error) {
        throw { code: 'SIGNOUT_FAILED', message: error.message }
      }

      // State will be reset by the auth listener
    }
    catch (error: any) {
      console.error('Sign out failed:', error)
      throw error
    }
    finally {
      isLoading.value = false
    }
  }

  // Team management methods
  const inviteMember = async (email: string, role: string = 'member'): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (!['owner', 'admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can invite members' }
      }

      const { data, error } = await getClient().functions.invoke('invite-member', {
        body: {
          email,
          role,
          team_id: currentTeam.value.id,
        },
      })

      if (error) {
        throw { code: 'INVITE_FAILED', message: error.message }
      }
    }
    catch (error: any) {
      console.error('Invite member failed:', error)
      throw error
    }
  }

  const revokeInvite = async (inviteId: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (!['owner', 'admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can revoke invites' }
      }

      const { error } = await getClient()
        .from('invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('team_id', currentTeam.value.id)

      if (error) {
        throw { code: 'REVOKE_FAILED', message: error.message }
      }
    }
    catch (error: any) {
      console.error('Revoke invite failed:', error)
      throw error
    }
  }

  const resendInvite = async (inviteId: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (!['owner', 'admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can resend invites' }
      }

      // Get the invite details
      const { data: invite, error: fetchError } = await getClient()
        .from('invites')
        .select('email, team_id')
        .eq('id', inviteId)
        .eq('team_id', currentTeam.value.id)
        .single()

      if (fetchError || !invite) {
        throw { code: 'INVITE_NOT_FOUND', message: 'Invite not found' }
      }

      // Delete the old invite and create a new one
      const { error: deleteError } = await getClient()
        .from('invites')
        .delete()
        .eq('id', inviteId)

      if (deleteError) {
        throw { code: 'DELETE_FAILED', message: deleteError.message }
      }

      // Create new invite
      await inviteMember(invite.email, 'member')
    }
    catch (error: any) {
      console.error('Resend invite failed:', error)
      throw error
    }
  }

  const promote = async (userId: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (currentRole.value !== 'owner') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners can promote members' }
      }

      const { error } = await getClient()
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', currentTeam.value.id)
        .eq('user_id', userId)
        .neq('role', 'owner')

      if (error) {
        throw { code: 'PROMOTION_FAILED', message: error.message }
      }
    }
    catch (error: any) {
      console.error('Promote member failed:', error)
      throw error
    }
  }

  const demote = async (userId: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (!['owner', 'admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can demote members' }
      }

      // Owners can demote admins to members, admins can demote members (but this is essentially a no-op)
      const { error } = await getClient()
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', currentTeam.value.id)
        .eq('user_id', userId)
        .neq('role', 'owner')

      if (error) {
        throw { code: 'DEMOTION_FAILED', message: error.message }
      }
    }
    catch (error: any) {
      console.error('Demote member failed:', error)
      throw error
    }
  }

  const transferOwnership = async (userId: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (currentRole.value !== 'owner') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners can transfer ownership' }
      }

      const { data, error } = await getClient().functions.invoke('transfer-ownership', {
        body: {
          team_id: currentTeam.value.id,
          new_owner_id: userId,
        },
      })

      if (error) {
        throw { code: 'TRANSFER_FAILED', message: error.message }
      }

      // Update local state - current user is now admin
      currentRole.value = 'admin'
    }
    catch (error: any) {
      console.error('Transfer ownership failed:', error)
      throw error
    }
  }

  // Profile management methods
  const getProfile = async (): Promise<Profile | null> => {
    try {
      if (!currentUser.value) {
        throw { code: 'NOT_AUTHENTICATED', message: 'User not authenticated' }
      }

      const { data, error } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', currentUser.value.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, return null
          return null
        }
        throw { code: 'FETCH_FAILED', message: error.message }
      }

      return data
    }
    catch (error: any) {
      console.error('Get profile failed:', error)
      throw error
    }
  }

  const updateProfile = async (updates: Partial<Profile>): Promise<void> => {
    try {
      if (!currentUser.value) {
        throw { code: 'NOT_AUTHENTICATED', message: 'User not authenticated' }
      }

      // Handle password update separately through auth
      const profileUpdates = { ...updates }
      const authUpdates: any = {}

      if ('password' in updates) {
        authUpdates.password = updates.password
        delete profileUpdates.password
      }

      // Update auth user if password is being changed
      if (authUpdates.password) {
        const { error: authError } = await getClient().auth.updateUser(authUpdates)
        if (authError) {
          throw { code: 'AUTH_UPDATE_FAILED', message: authError.message }
        }
      }

      // Update profile in profiles table
      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await getClient()
          .from('profiles')
          .upsert({
            id: currentUser.value.id,
            ...profileUpdates,
          })
          .eq('id', currentUser.value.id)

        if (error) {
          throw { code: 'PROFILE_UPDATE_FAILED', message: error.message }
        }

        // Update reactive state - force reactivity by reassigning the ref
        if (currentProfile.value) {
          currentProfile.value = { ...currentProfile.value, ...profileUpdates }
          // Force reactivity trigger as backup
          triggerRef(currentProfile)
        }
        else {
          // Load the full profile if we don't have it yet
          currentProfile.value = await getProfile()
        }
      }
    }
    catch (error: any) {
      console.error('Update profile failed:', error)
      throw error
    }
  }

  const renameTeam = async (name: string): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (currentRole.value !== 'owner') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners can rename the team' }
      }

      if (!name.trim()) {
        throw { code: 'INVALID_NAME', message: 'Team name cannot be empty' }
      }

      const { error } = await getClient()
        .from('teams')
        .update({ name: name.trim() })
        .eq('id', currentTeam.value.id)

      if (error) {
        throw { code: 'RENAME_FAILED', message: error.message }
      }

      // Update local state
      if (currentTeam.value) {
        currentTeam.value.name = name.trim()
      }
    }
    catch (error: any) {
      console.error('Rename team failed:', error)
      throw error
    }
  }

  const updateTeam = async (updates: Partial<Team>): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (currentRole.value !== 'owner') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners can update team settings' }
      }

      // Remove fields that shouldn't be updated
      const { id, created_at, ...updateableFields } = updates

      const { error } = await getClient()
        .from('teams')
        .update(updateableFields)
        .eq('id', currentTeam.value.id)

      if (error) {
        throw { code: 'UPDATE_FAILED', message: error.message }
      }

      // Update local state
      if (currentTeam.value) {
        currentTeam.value = { ...currentTeam.value, ...updateableFields }
      }
    }
    catch (error: any) {
      console.error('Update team failed:', error)
      throw error
    }
  }

  const deleteTeam = async (): Promise<void> => {
    try {
      if (!currentTeam.value) {
        throw { code: 'NO_TEAM', message: 'No team selected' }
      }

      if (currentRole.value !== 'owner') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners can delete the team' }
      }

      // Check if there are other members
      const { data: members, error: membersError } = await getClient()
        .from('team_members')
        .select('user_id')
        .eq('team_id', currentTeam.value.id)

      if (membersError) {
        throw { code: 'CHECK_MEMBERS_FAILED', message: membersError.message }
      }

      if (members && members.length > 1) {
        throw { code: 'TEAM_HAS_MEMBERS', message: 'Cannot delete team with other members. Transfer ownership or remove members first.' }
      }

      // Delete the team (cascade will handle related records)
      const { error } = await getClient()
        .from('teams')
        .delete()
        .eq('id', currentTeam.value.id)

      if (error) {
        throw { code: 'DELETE_FAILED', message: error.message }
      }

      // Reset team state
      currentTeam.value = null
      currentRole.value = null
    }
    catch (error: any) {
      console.error('Delete team failed:', error)
      throw error
    }
  }

  // Session storage is now handled by useImpersonation composable

  // Impersonation methods - simplified placeholders that delegate to useImpersonation
  const startImpersonation = async (targetUserId: string, reason: string): Promise<void> => {
    // This method is kept for backward compatibility
    // The actual implementation is in useImpersonation composable
    const { startImpersonation: start } = useImpersonation()
    await start(targetUserId, reason)
  }

  const stopImpersonation = async (): Promise<void> => {
    // This method is kept for backward compatibility
    // The actual implementation is in useImpersonation composable
    const { stopImpersonation: stop } = useImpersonation()
    await stop()
  }

  // Sync impersonation state with useImpersonation composable
  const syncImpersonationState = () => {
    const { isImpersonating: impersonating, impersonationExpiresAt: expiresAt } = useImpersonation()
    isImpersonating.value = impersonating.value
    impersonationExpiresAt.value = expiresAt.value
  }

  // Watch for impersonation state changes
  if (import.meta.client) {
    watch(() => {
      const { isImpersonating: impersonating } = useImpersonation()
      return impersonating.value
    }, (newValue) => {
      syncImpersonationState()
    })
  }

  // Handle impersonation expiration
  const checkImpersonationExpiration = () => {
    if (isImpersonating.value && impersonationExpiresAt.value) {
      const now = new Date()
      if (now >= impersonationExpiresAt.value) {
        console.warn('Impersonation session expired, stopping impersonation')
        stopImpersonation().catch((error) => {
          console.error('Failed to stop expired impersonation:', error)
        })
      }
    }
  }

  // Session persistence keys
  const SESSION_STORAGE_KEYS = {
    USER_STATE: 'team_auth_user_state',
    TEAM_STATE: 'team_auth_team_state',
    ROLE_STATE: 'team_auth_role_state',
    LAST_SYNC: 'team_auth_last_sync',
  }

  // Store current state to localStorage
  const persistState = () => {
    try {
      if (typeof window === 'undefined') return

      const stateToStore = {
        currentUser: currentUser.value,
        currentTeam: currentTeam.value,
        currentRole: currentRole.value,
        isImpersonating: isImpersonating.value,
        impersonationExpiresAt: impersonationExpiresAt.value?.toISOString(),
        lastSync: new Date().toISOString(),
      }

      localStorage.setItem(SESSION_STORAGE_KEYS.USER_STATE, JSON.stringify(stateToStore))
    }
    catch (error) {
      console.error('Failed to persist auth state:', error)
    }
  }

  // Restore state from localStorage
  const restoreState = () => {
    try {
      if (typeof window === 'undefined') return false

      const storedState = localStorage.getItem(SESSION_STORAGE_KEYS.USER_STATE)
      if (!storedState) return false

      const parsed = JSON.parse(storedState)

      // Check if stored state is recent (within 24 hours)
      const lastSync = new Date(parsed.lastSync)
      const now = new Date()
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)

      if (hoursSinceSync > 24) {
        localStorage.removeItem(SESSION_STORAGE_KEYS.USER_STATE)
        return false
      }

      // Restore state
      currentUser.value = parsed.currentUser
      currentTeam.value = parsed.currentTeam
      currentRole.value = parsed.currentRole
      isImpersonating.value = parsed.isImpersonating || false

      if (parsed.impersonationExpiresAt) {
        impersonationExpiresAt.value = new Date(parsed.impersonationExpiresAt)
      }

      return true
    }
    catch (error) {
      console.error('Failed to restore auth state:', error)
      localStorage.removeItem(SESSION_STORAGE_KEYS.USER_STATE)
      return false
    }
  }

  // Clear persisted state
  const clearPersistedState = () => {
    try {
      if (typeof window === 'undefined') return
      localStorage.removeItem(SESSION_STORAGE_KEYS.USER_STATE)
    }
    catch (error) {
      console.error('Failed to clear persisted state:', error)
    }
  }

  // Watch for state changes and persist them
  watch([currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt], () => {
    persistState()
  }, { deep: true })

  // Dual-session management utilities
  const getDualSessionState = () => {
    if (typeof window === 'undefined') {
      return {
        hasOriginalSession: false,
        hasImpersonationSession: false,
        originalSession: null,
        impersonationData: null,
      }
    }

    // Get impersonation state using the proper architecture
    const { isImpersonating } = useImpersonation()
    const impersonationData = sessionStorage.getItem('team_auth_impersonation')
    const storedOriginal = impersonationData ? JSON.parse(impersonationData).originalAccessToken : null
    const storedImpersonation = impersonationData

    return {
      hasOriginalSession: !!storedOriginal,
      hasImpersonationSession: !!storedImpersonation,
      originalSession: storedOriginal,
      impersonationData: storedImpersonation ? JSON.parse(storedImpersonation) : null,
    }
  }

  const validateDualSessionIntegrity = () => {
    const dualState = getDualSessionState()

    // If we're marked as impersonating but missing session data, clear state
    if (isImpersonating.value && !dualState.hasOriginalSession) {
      console.warn('Impersonation state inconsistent, clearing')
      isImpersonating.value = false
      impersonationExpiresAt.value = null
      clearImpersonationData()
      return false
    }

    // Check impersonation expiration from stored data
    if (dualState.impersonationData?.expires_at) {
      const expiresAt = new Date(dualState.impersonationData.expires_at)
      if (new Date() >= expiresAt) {
        console.warn('Stored impersonation session expired, clearing')
        stopImpersonation().catch(console.error)
        return false
      }
    }

    return true
  }

  const seamlessSessionSwitch = async (targetSession: 'original' | 'impersonation') => {
    try {
      const dualState = getDualSessionState()

      if (targetSession === 'original' && dualState.hasOriginalSession) {
        // Switch back to original session
        await getClient().auth.setSession({
          access_token: dualState.originalSession!.session.access_token,
          refresh_token: dualState.originalSession!.session.refresh_token,
        })

        // Update state flags
        isImpersonating.value = false
        impersonationExpiresAt.value = null

        return true
      }
      else if (targetSession === 'impersonation' && dualState.hasImpersonationSession) {
        // This would be used if we need to switch back to impersonation session
        // (though this is less common - usually we go original -> impersonation -> original)
        console.warn('Switching to impersonation session - this should be rare')
        return false
      }

      return false
    }
    catch (error) {
      console.error('Failed to switch sessions:', error)
      return false
    }
  }

  // Enhanced state initialization with dual-session awareness and cross-tab sync
  const initializeStateWithRestore = async () => {
    try {
      isLoading.value = true

      // Skip Supabase calls during SSR
      if (process.server) {
        isLoading.value = false
        return
      }

      // First try to restore from localStorage
      const restored = restoreState()

      // Check dual-session integrity
      validateDualSessionIntegrity()

      // Get current session from Supabase
      const { data: { session } } = await getClient().auth.getSession()

      if (session?.user) {
        // Validate session by trying to fetch user's team data
        try {
          await updateStateFromSession(session)
        }
        catch (error: any) {
          // If session is invalid (e.g., user doesn't exist in database after reset)
          console.warn('Session validation failed, clearing invalid session:', error.message)
          await getClient().auth.signOut()
          resetState()
          return // Exit early since signOut will trigger the auth listener
        }

        // If we have an impersonation session stored but current session doesn't indicate impersonation,
        // there might be a session mismatch - clear impersonation data
        // Note: Since we no longer use JWT claims for impersonation detection, we rely on stored session data
        const dualState = getDualSessionState()
        if (!dualState.hasImpersonationSession && isImpersonating.value) {
          console.warn('Session mismatch detected, clearing impersonation state')
          isImpersonating.value = false
          impersonationExpiresAt.value = null
          clearImpersonationData()
        }
      }
      else if (!restored) {
        // No session and no restored state - reset everything
        resetState()
        clearPersistedState()
      }
      else {
        // We have restored state but no active session
        // This could be a temporary network issue or expired session
        const dualState = getDualSessionState()

        if (dualState.hasOriginalSession && isImpersonating.value) {
          // Try to restore original session if impersonation might have expired
          console.info('Attempting to restore original session due to missing current session')
          await seamlessSessionSwitch('original')
        }
      }
    }
    catch (error) {
      console.error('Failed to initialize auth state:', error)
      resetState()
      clearPersistedState()
    }
    finally {
      isLoading.value = false
    }
  }

  // Enhanced reset state that also clears persistence
  const resetStateWithClear = () => {
    resetState()
    clearPersistedState()
    clearImpersonationData()
  }

  // Avatar fallback generation utility
  const getAvatarFallback = (overrides?: {
    fullName?: string | null
    email?: string | null
  }): string => {
    // Priority order for full name:
    // 1. Override value (typically from profiles.full_name)
    // 2. Current user's user_metadata.name (standard Supabase auth field)
    const fullName = overrides?.fullName !== undefined
      ? overrides.fullName
      : currentUser.value?.user_metadata?.name

    // Priority order for email:
    // 1. Override value
    // 2. Current user's email
    const email = overrides?.email !== undefined
      ? overrides.email
      : currentUser.value?.email

    // Generate initials from full name if available
    if (fullName && fullName.trim()) {
      return fullName
        .trim()
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    // Fallback to first letter of email
    if (email) {
      return email[0].toUpperCase()
    }

    return 'U'
  }

  // Get team members with their profiles and update reactive state
  const getTeamMembers = async () => {
    if (!currentTeam.value) {
      throw new Error('No current team available')
    }

    // Check if we have a valid session before making the query
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

    // Map team members with email from profiles table
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

    // Update reactive state
    teamMembers.value = mappedMembers
    return mappedMembers
  }

  // Update team member role
  const updateMemberRole = async (userId: string, newRole: string) => {
    if (!currentTeam.value) {
      throw new Error('No current team available')
    }

    const { error } = await getClient()
      .from('team_members')
      .update({ role: newRole })
      .eq('team_id', currentTeam.value.id)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`)
    }

    // Update reactive state immediately
    const memberIndex = teamMembers.value.findIndex(m => m.user_id === userId)
    if (memberIndex !== -1) {
      teamMembers.value[memberIndex].role = newRole
    }
  }

  const removeMember = async (userId: string) => {
    if (!currentTeam.value) {
      throw new Error('No current team available')
    }

    const { error } = await getClient()
      .from('team_members')
      .delete()
      .eq('team_id', currentTeam.value.id)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`)
    }

    // Update reactive state immediately - remove member from list
    teamMembers.value = teamMembers.value.filter(m => m.user_id !== userId)
  }

  // Get another user's profile (admin/owner only)
  const getTeamMemberProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // Check if user has admin/owner permissions
      if (!['admin', 'owner', 'super_admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins and owners can view team member profiles' }
      }

      const { data, error } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist
          return null
        }
        throw { code: 'FETCH_FAILED', message: error.message }
      }

      return data
    }
    catch (error: any) {
      console.error('Get team member profile failed:', error)
      throw error
    }
  }

  // Update another user's profile (admin/owner only)
  const updateTeamMemberProfile = async (userId: string, updates: Partial<Profile>): Promise<void> => {
    try {
      // Check if user has admin/owner permissions
      if (!['admin', 'owner', 'super_admin'].includes(currentRole.value || '')) {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins and owners can update team member profiles' }
      }

      // Don't allow editing own profile through this method
      if (userId === currentUser.value?.id) {
        throw { code: 'INVALID_OPERATION', message: 'Use updateProfile to edit your own profile' }
      }

      // Filter to only allow safe fields
      const allowedFields = ['full_name', 'phone', 'bio', 'timezone', 'language']
      const safeUpdates: any = {}

      for (const key of allowedFields) {
        if (key in updates) {
          safeUpdates[key] = updates[key as keyof Profile]
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        throw { code: 'NO_UPDATES', message: 'No allowed fields to update' }
      }

      const { error } = await getClient()
        .from('profiles')
        .update(safeUpdates)
        .eq('id', userId)

      if (error) {
        throw { code: 'UPDATE_FAILED', message: error.message }
      }

      // Update team members reactive state if this user is in the list
      const memberIndex = teamMembers.value.findIndex(m => m.user_id === userId)
      if (memberIndex !== -1 && teamMembers.value[memberIndex].profile) {
        // Update the profile data in team members
        teamMembers.value[memberIndex].profile = {
          ...teamMembers.value[memberIndex].profile,
          ...safeUpdates,
        }
      }
    }
    catch (error: any) {
      console.error('Update team member profile failed:', error)
      throw error
    }
  }

  // Enhanced auth listener that handles persistence
  const setupEnhancedAuthListener = () => {
    if (process.server) return
    
    getClient().auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session) {
          await updateStateFromSession(session)
        }
        else if (event === 'SIGNED_OUT') {
          resetStateWithClear()
        }
        else if (event === 'TOKEN_REFRESHED' && session) {
          await updateStateFromSession(session)
        }
      }
      catch (error) {
        console.error('Auth state change error:', error)
        // Don't let auth listener errors break the sign-in process
        if (event === 'SIGNED_IN' && session) {
          // Set minimal user state even if team fetching fails
          currentUser.value = {
            id: session.user.id,
            email: session.user.email!,
            user_metadata: session.user.user_metadata,
          }
        }
      }
    })
  }

  // Session sync setup
  const sessionSync = useSessionSync()
  let sessionSyncCleanup: (() => void) | null = null

  // Initialize immediately for testing, or on mount for real usage
  const initializeComposable = async () => {
    await initializeStateWithRestore()
    
    // Only set up auth listener on client-side
    if (!process.server) {
      setupEnhancedAuthListener()
    }

    // Set up cross-tab session synchronization
    sessionSyncCleanup = sessionSync.initializeSessionSync(
      currentUser,
      currentTeam,
      currentRole,
      isImpersonating,
      impersonationExpiresAt,
      (state, eventType) => {
        console.info(`Cross-tab sync: ${eventType}`, state)
        // Additional handling for specific sync events can be added here
      },
    )

    // Set up periodic expiration checks for impersonation (client-side only)
    let expirationInterval: NodeJS.Timeout | null = null
    if (!process.server) {
      expirationInterval = setInterval(() => {
        checkImpersonationExpiration()
      }, 60000) // Check every minute
    }

    // Clean up intervals and session sync on unmount
    if (getCurrentInstance()) {
      onUnmounted(() => {
        if (expirationInterval) {
          clearInterval(expirationInterval)
        }
        if (sessionSyncCleanup) {
          sessionSyncCleanup()
        }
      })
    }
  }

  // Initialize based on context
  let initializationPromise: Promise<void>

  // Check if we're in a component context
  const currentInstance = getCurrentInstance()
  
  if (injectedClient || !currentInstance) {
    // Test environment or non-component context - initialize immediately
    initializationPromise = initializeComposable()
  }
  else {
    // Component context - use onMounted
    let initResolver: () => void
    initializationPromise = new Promise<void>((resolve) => {
      initResolver = resolve
    })

    onMounted(() => {
      initializeComposable().then(initResolver)
    })
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

    // Methods
    signUpWithTeam,
    signIn,
    signOut,
    inviteMember,
    revokeInvite,
    resendInvite,
    promote,
    demote,
    transferOwnership,
    getProfile,
    updateProfile,
    renameTeam,
    updateTeam,
    deleteTeam,
    startImpersonation,
    stopImpersonation,
    getAvatarFallback,
    getTeamMembers,
    updateMemberRole,
    removeMember,
    getTeamMemberProfile,
    updateTeamMemberProfile,

    // Session management utilities
    sessionHealth: () => sessionSync.performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    triggerSessionRecovery: () => sessionSync.triggerSessionRecovery(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    getActiveTabs: sessionSync.getActiveTabs,
    isTabPrimary: sessionSync.isPrimaryTab,

    // Testing utilities
    $initializationPromise: initializationPromise,
    
    // Force refresh auth state (for impersonation debugging)
    refreshAuthState: async () => {
      try {
        const { data: { session } } = await getClient().auth.getSession()
        if (session) {
          await updateStateFromSession(session)
        } else {
          resetState()
        }
      } catch (error) {
        console.error('Failed to refresh auth state:', error)
      }
    },
  }
}

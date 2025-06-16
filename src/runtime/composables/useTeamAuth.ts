import { ref, reactive, computed, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import type { SupabaseClient, AuthSession, User as SupabaseUser } from '@supabase/supabase-js'
import type { User, Profile, Team, TeamMember, TeamAuth, TeamAuthState } from '../types'
import { useSessionSync } from './useSessionSync'

interface TeamAuthError {
  code: string
  message: string
}


export function useTeamAuth(injectedClient?: SupabaseClient): TeamAuth {
  // Reactive state
  const currentUser = ref<User | null>(null)
  const currentTeam = ref<Team | null>(null)
  const currentRole = ref<string | null>(null)
  const isLoading = ref(true)
  const isImpersonating = ref(false)
  const impersonationExpiresAt = ref<Date | null>(null)
  
  // Supabase client initialization - for client-only usage
  const getSupabaseClient = (): SupabaseClient => {
    if (injectedClient) return injectedClient
    
    const nuxtApp = useNuxtApp()
    if (!nuxtApp?.$teamAuthClient) {
      throw new Error('Supabase client not available. Ensure auth components are wrapped in <ClientOnly>')
    }
    return nuxtApp.$teamAuthClient as SupabaseClient
  }
  
  const supabase = getSupabaseClient()
  
  
  // State initialization
  const initializeState = async () => {
    try {
      isLoading.value = true
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        await updateStateFromSession(session)
      } else {
        resetState()
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error)
      resetState()
    } finally {
      isLoading.value = false
    }
  }
  
  // Update state from session
  const updateStateFromSession = async (session: AuthSession) => {
    const user = session.user
    
    // Set current user
    currentUser.value = {
      id: user.id,
      email: user.email!,
      user_metadata: user.user_metadata
    }
    
    // Fetch team information from database
    try {
      const { data: teamMember, error } = await supabase
        .from('team_members')
        .select(`
          role,
          teams (
            id,
            name,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .single()
      
      if (!error && teamMember) {
        currentTeam.value = {
          id: teamMember.teams.id,
          name: teamMember.teams.name,
          created_at: teamMember.teams.created_at
        }
        currentRole.value = teamMember.role
      } else {
        // No team membership found
        currentTeam.value = null
        currentRole.value = null
      }
    } catch (error) {
      console.warn('Failed to fetch team information:', error)
      currentTeam.value = null
      currentRole.value = null
    }
    
    // Reset impersonation state (we're not using JWT claims for this yet)
    isImpersonating.value = false
    impersonationExpiresAt.value = null
  }
  
  // Reset state on sign out
  const resetState = () => {
    currentUser.value = null
    currentTeam.value = null
    currentRole.value = null
    isImpersonating.value = false
    impersonationExpiresAt.value = null
  }
  
  // Auth state change listener
  const setupAuthListener = () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await updateStateFromSession(session)
      } else if (event === 'SIGNED_OUT') {
        resetState()
      } else if (event === 'TOKEN_REFRESHED' && session) {
        await updateStateFromSession(session)
      }
    })
  }
  
  // Authentication methods
  const signUpWithTeam = async (email: string, password: string, teamName: string): Promise<void> => {
    try {
      isLoading.value = true
      
      // Call Edge Function to create user and team in one transaction
      const { data, error } = await supabase.functions.invoke('create-team-and-owner', {
        body: { 
          email, 
          password, 
          team_name: teamName 
        }
      })
      
      if (error) {
        throw { code: 'TEAM_CREATION_FAILED', message: error.message }
      }
      
      if (!data?.success) {
        throw { code: 'TEAM_CREATION_FAILED', message: 'Edge Function returned unsuccessful response' }
      }
      
      // The Edge Function creates the user and team, now we need to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (signInError) {
        throw { code: 'SIGNIN_FAILED', message: signInError.message }
      }
      
      // State will be updated by the auth listener
    } catch (error: any) {
      console.error('Sign up with team failed:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      isLoading.value = true
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        throw { code: 'SIGNIN_FAILED', message: error.message }
      }
      
      // State will be updated by the auth listener
    } catch (error: any) {
      console.error('Sign in failed:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const signOut = async (): Promise<void> => {
    try {
      isLoading.value = true
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw { code: 'SIGNOUT_FAILED', message: error.message }
      }
      
      // State will be reset by the auth listener
    } catch (error: any) {
      console.error('Sign out failed:', error)
      throw error
    } finally {
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
      
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { 
          email, 
          role,
          team_id: currentTeam.value.id 
        }
      })
      
      if (error) {
        throw { code: 'INVITE_FAILED', message: error.message }
      }
    } catch (error: any) {
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
      
      const { error } = await supabase
        .from('invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('team_id', currentTeam.value.id)
      
      if (error) {
        throw { code: 'REVOKE_FAILED', message: error.message }
      }
    } catch (error: any) {
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
      const { data: invite, error: fetchError } = await supabase
        .from('invites')
        .select('email, team_id')
        .eq('id', inviteId)
        .eq('team_id', currentTeam.value.id)
        .single()
      
      if (fetchError || !invite) {
        throw { code: 'INVITE_NOT_FOUND', message: 'Invite not found' }
      }
      
      // Delete the old invite and create a new one
      const { error: deleteError } = await supabase
        .from('invites')
        .delete()
        .eq('id', inviteId)
      
      if (deleteError) {
        throw { code: 'DELETE_FAILED', message: deleteError.message }
      }
      
      // Create new invite
      await inviteMember(invite.email, 'member')
    } catch (error: any) {
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
      
      const { error } = await supabase
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', currentTeam.value.id)
        .eq('user_id', userId)
        .neq('role', 'owner')
      
      if (error) {
        throw { code: 'PROMOTION_FAILED', message: error.message }
      }
    } catch (error: any) {
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
      const { error } = await supabase
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', currentTeam.value.id)
        .eq('user_id', userId)
        .neq('role', 'owner')
      
      if (error) {
        throw { code: 'DEMOTION_FAILED', message: error.message }
      }
    } catch (error: any) {
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
      
      const { data, error } = await supabase.functions.invoke('transfer-ownership', {
        body: { 
          team_id: currentTeam.value.id,
          new_owner_id: userId 
        }
      })
      
      if (error) {
        throw { code: 'TRANSFER_FAILED', message: error.message }
      }
      
      // Update local state - current user is now admin
      currentRole.value = 'admin'
    } catch (error: any) {
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
      
      const { data, error } = await supabase
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
    } catch (error: any) {
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
      let authUpdates: any = {}
      
      if ('password' in updates) {
        authUpdates.password = updates.password
        delete profileUpdates.password
      }
      
      // Update auth user if password is being changed
      if (authUpdates.password) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) {
          throw { code: 'AUTH_UPDATE_FAILED', message: authError.message }
        }
      }
      
      // Update profile in profiles table
      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: currentUser.value.id,
            ...profileUpdates
          })
          .eq('id', currentUser.value.id)
        
        if (error) {
          throw { code: 'PROFILE_UPDATE_FAILED', message: error.message }
        }
      }
    } catch (error: any) {
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
      
      const { error } = await supabase
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
    } catch (error: any) {
      console.error('Rename team failed:', error)
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
      const { data: members, error: membersError } = await supabase
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
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', currentTeam.value.id)
      
      if (error) {
        throw { code: 'DELETE_FAILED', message: error.message }
      }
      
      // Reset team state
      currentTeam.value = null
      currentRole.value = null
    } catch (error: any) {
      console.error('Delete team failed:', error)
      throw error
    }
  }
  
  // Four-tier token storage system for impersonation
  const STORAGE_KEYS = {
    TIER_1: 'team_auth_session',           // Primary session data
    TIER_2: 'team_auth_impersonation',     // Impersonation metadata
    TIER_3: 'team_auth_original_user',     // Original user backup
    TIER_4: 'team_auth_security_token'     // Security validation token
  }
  
  const storeImpersonationData = (originalSession: AuthSession, impersonationData: any) => {
    try {
      if (typeof window === 'undefined') return
      
      // Tier 1: Store current session backup
      localStorage.setItem(STORAGE_KEYS.TIER_1, JSON.stringify({
        access_token: originalSession.access_token,
        refresh_token: originalSession.refresh_token,
        expires_at: originalSession.expires_at,
        user: originalSession.user
      }))
      
      // Tier 2: Store impersonation metadata
      sessionStorage.setItem(STORAGE_KEYS.TIER_2, JSON.stringify({
        session_id: impersonationData.session_id,
        target_user_id: impersonationData.target_user_id,
        started_at: new Date().toISOString(),
        expires_at: impersonationData.expires_at
      }))
      
      // Tier 3: Store original user data
      localStorage.setItem(STORAGE_KEYS.TIER_3, JSON.stringify({
        user_id: originalSession.user.id,
        email: originalSession.user.email,
        team_id: currentTeam.value?.id,
        role: currentRole.value
      }))
      
      // Tier 4: Generate security token for validation
      const securityToken = btoa(JSON.stringify({
        timestamp: Date.now(),
        user_id: originalSession.user.id,
        session_id: impersonationData.session_id
      }))
      sessionStorage.setItem(STORAGE_KEYS.TIER_4, securityToken)
    } catch (error) {
      console.error('Failed to store impersonation data:', error)
      throw { code: 'STORAGE_FAILED', message: 'Failed to store impersonation session data' }
    }
  }
  
  const clearImpersonationData = () => {
    try {
      if (typeof window === 'undefined') return
      
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      })
    } catch (error) {
      console.error('Failed to clear impersonation data:', error)
    }
  }
  
  const getStoredOriginalSession = () => {
    try {
      if (typeof window === 'undefined') return null
      
      const tier1Data = localStorage.getItem(STORAGE_KEYS.TIER_1)
      const tier3Data = localStorage.getItem(STORAGE_KEYS.TIER_3)
      const tier4Data = sessionStorage.getItem(STORAGE_KEYS.TIER_4)
      
      if (!tier1Data || !tier3Data || !tier4Data) {
        return null
      }
      
      return {
        session: JSON.parse(tier1Data),
        originalUser: JSON.parse(tier3Data),
        securityToken: tier4Data
      }
    } catch (error) {
      console.error('Failed to retrieve stored session:', error)
      return null
    }
  }
  
  // Impersonation methods
  const startImpersonation = async (targetUserId: string, reason: string): Promise<void> => {
    try {
      if (!currentUser.value) {
        throw { code: 'NOT_AUTHENTICATED', message: 'User not authenticated' }
      }
      
      if (currentRole.value !== 'super_admin') {
        throw { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only super admins can start impersonation' }
      }
      
      if (isImpersonating.value) {
        throw { code: 'ALREADY_IMPERSONATING', message: 'Already impersonating another user' }
      }
      
      // Get current session for backup
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        throw { code: 'NO_SESSION', message: 'No active session found' }
      }
      
      // Call start-impersonation Edge Function
      const { data, error } = await supabase.functions.invoke('start-impersonation', {
        body: { 
          target_user_id: targetUserId,
          reason: reason.trim()
        }
      })
      
      if (error) {
        throw { code: 'IMPERSONATION_FAILED', message: error.message }
      }
      
      if (!data?.access_token || !data?.session_id) {
        throw { code: 'INVALID_RESPONSE', message: 'Invalid response from impersonation service' }
      }
      
      // Store original session data in four-tier system
      storeImpersonationData(currentSession, {
        session_id: data.session_id,
        target_user_id: targetUserId,
        expires_at: data.expires_at
      })
      
      // Set the new impersonation session
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      })
      
      // Update reactive state
      isImpersonating.value = true
      if (data.expires_at) {
        impersonationExpiresAt.value = new Date(data.expires_at)
      }
      
      // The auth listener will update the user/team state from the new JWT
    } catch (error: any) {
      console.error('Start impersonation failed:', error)
      throw error
    }
  }
  
  const stopImpersonation = async (): Promise<void> => {
    try {
      if (!isImpersonating.value) {
        throw { code: 'NOT_IMPERSONATING', message: 'Not currently impersonating' }
      }
      
      // Get stored original session
      const storedData = getStoredOriginalSession()
      if (!storedData) {
        throw { code: 'NO_ORIGINAL_SESSION', message: 'Original session data not found' }
      }
      
      // Call stop-impersonation Edge Function
      const { error } = await supabase.functions.invoke('stop-impersonation', {
        body: {} // Edge Function will handle session cleanup
      })
      
      if (error) {
        console.warn('Stop impersonation Edge Function failed:', error)
        // Continue with local cleanup even if Edge Function fails
      }
      
      // Restore original session
      await supabase.auth.setSession({
        access_token: storedData.session.access_token,
        refresh_token: storedData.session.refresh_token
      })
      
      // Clear impersonation storage
      clearImpersonationData()
      
      // Reset impersonation state
      isImpersonating.value = false
      impersonationExpiresAt.value = null
      
      // The auth listener will restore the original user/team state
    } catch (error: any) {
      console.error('Stop impersonation failed:', error)
      // In case of error, try to clear storage anyway
      clearImpersonationData()
      isImpersonating.value = false
      impersonationExpiresAt.value = null
      throw error
    }
  }
  
  // Handle impersonation expiration
  const checkImpersonationExpiration = () => {
    if (isImpersonating.value && impersonationExpiresAt.value) {
      const now = new Date()
      if (now >= impersonationExpiresAt.value) {
        console.warn('Impersonation session expired, stopping impersonation')
        stopImpersonation().catch(error => {
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
    LAST_SYNC: 'team_auth_last_sync'
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
        lastSync: new Date().toISOString()
      }
      
      localStorage.setItem(SESSION_STORAGE_KEYS.USER_STATE, JSON.stringify(stateToStore))
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
        impersonationData: null
      }
    }
    
    const storedOriginal = getStoredOriginalSession()
    const storedImpersonation = sessionStorage.getItem(STORAGE_KEYS.TIER_2)
    
    return {
      hasOriginalSession: !!storedOriginal,
      hasImpersonationSession: !!storedImpersonation,
      originalSession: storedOriginal,
      impersonationData: storedImpersonation ? JSON.parse(storedImpersonation) : null
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
        await supabase.auth.setSession({
          access_token: dualState.originalSession!.session.access_token,
          refresh_token: dualState.originalSession!.session.refresh_token
        })
        
        // Update state flags
        isImpersonating.value = false
        impersonationExpiresAt.value = null
        
        return true
      } else if (targetSession === 'impersonation' && dualState.hasImpersonationSession) {
        // This would be used if we need to switch back to impersonation session
        // (though this is less common - usually we go original -> impersonation -> original)
        console.warn('Switching to impersonation session - this should be rare')
        return false
      }
      
      return false
    } catch (error) {
      console.error('Failed to switch sessions:', error)
      return false
    }
  }
  
  // Enhanced state initialization with dual-session awareness and cross-tab sync
  const initializeStateWithRestore = async () => {
    try {
      isLoading.value = true
      
      // First try to restore from localStorage
      const restored = restoreState()
      
      // Check dual-session integrity
      validateDualSessionIntegrity()
      
      // Get current session from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Update state from session (this will override restored state if different)
        await updateStateFromSession(session)
        
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
      } else if (!restored) {
        // No session and no restored state - reset everything
        resetState()
        clearPersistedState()
      } else {
        // We have restored state but no active session
        // This could be a temporary network issue or expired session
        const dualState = getDualSessionState()
        
        if (dualState.hasOriginalSession && isImpersonating.value) {
          // Try to restore original session if impersonation might have expired
          console.info('Attempting to restore original session due to missing current session')
          await seamlessSessionSwitch('original')
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize auth state:', error)
      resetState()
      clearPersistedState()
    } finally {
      isLoading.value = false
    }
  }
  
  // Enhanced reset state that also clears persistence
  const resetStateWithClear = () => {
    resetState()
    clearPersistedState()
    clearImpersonationData()
  }
  
  // Enhanced auth listener that handles persistence
  const setupEnhancedAuthListener = () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session) {
          await updateStateFromSession(session)
        } else if (event === 'SIGNED_OUT') {
          resetStateWithClear()
        } else if (event === 'TOKEN_REFRESHED' && session) {
          await updateStateFromSession(session)
        }
      } catch (error) {
        console.error('Auth state change error:', error)
        // Don't let auth listener errors break the sign-in process
        if (event === 'SIGNED_IN' && session) {
          // Set minimal user state even if team fetching fails
          currentUser.value = {
            id: session.user.id,
            email: session.user.email!,
            user_metadata: session.user.user_metadata
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
    setupEnhancedAuthListener()
    
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
      }
    )
    
    // Set up periodic expiration checks for impersonation
    const expirationInterval = setInterval(() => {
      checkImpersonationExpiration()
    }, 60000) // Check every minute
    
    // Clean up intervals and session sync on unmount
    if (getCurrentInstance()) {
      onUnmounted(() => {
        clearInterval(expirationInterval)
        if (sessionSyncCleanup) {
          sessionSyncCleanup()
        }
      })
    }
  }

  // For testing environments, initialize immediately
  // For component contexts, use onMounted
  let initializationPromise: Promise<void>
  
  // Simple heuristic: if we have injectedClient, we're likely in a test
  if (injectedClient) {
    initializationPromise = initializeComposable()
  } else {
    // Real component context - use onMounted
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
    currentTeam,
    currentRole,
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
    deleteTeam,
    startImpersonation,
    stopImpersonation,
    
    // Session management utilities
    sessionHealth: () => sessionSync.performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    triggerSessionRecovery: () => sessionSync.triggerSessionRecovery(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    getActiveTabs: sessionSync.getActiveTabs,
    isTabPrimary: sessionSync.isPrimaryTab,
    
    // Testing utilities
    $initializationPromise: initializationPromise
  }
}

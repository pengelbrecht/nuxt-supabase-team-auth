import { computed } from 'vue'
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import type { TeamAuth } from '../types'

interface _TeamAuthError {
  code: string
  message: string
}

// Single auth state using useState
const authState = useState('team-auth', () => ({
  user: null as User | null,
  profile: null as Profile | null,
  team: null as Team | null,
  role: null as string | null,
  teamMembers: [] as TeamMember[],
  loading: true,
  impersonating: false,
  impersonationExpiresAt: null as Date | null,
  initialized: false,
}))

export function useTeamAuth(injectedClient?: SupabaseClient): TeamAuth {
  // Extract reactive refs from state for compatibility
  const currentUser = computed(() => authState.value.user)
  const currentProfile = computed(() => authState.value.profile)
  const currentTeam = computed(() => authState.value.team)
  const currentRole = computed(() => authState.value.role)
  const teamMembers = computed(() => authState.value.teamMembers)
  const isLoading = computed(() => authState.value.loading)
  const isImpersonating = computed(() => authState.value.impersonating)
  const impersonationExpiresAt = computed(() => authState.value.impersonationExpiresAt)

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
    if (import.meta.server) {
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
          .single(),
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
      }

      console.log(`🔥 Auth state updated - User: ${user.email}, Team: ${authState.value.team?.name}, Role: ${authState.value.role}`)
    }
    catch (error) {
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
        loading: false,
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
      loading: false,
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
      }
      else {
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
    }
    catch (error) {
      console.error('🔥 Auth initialization failed:', error)
      authState.value = { ...authState.value, loading: false }
    }
  }

  // Initialize on client-side only
  if (import.meta.client && !authState.value.initialized) {
    initializeAuth()
  }

  // TODO: Add back essential methods like signOut, getProfile, etc.
  // For now, return minimal interface to test the new auth state

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

    // Essential methods (add more as needed)
    signOut: async () => {
      await getClient().auth.signOut()
    },

    getProfile: async () => {
      if (!currentUser.value) return null
      const { data } = await getClient()
        .from('profiles')
        .select('*')
        .eq('id', currentUser.value.id)
        .single()
      return data
    },

    // Placeholder methods - TODO: implement from original
    signUpWithTeam: async () => { throw new Error('Not implemented yet') },
    signIn: async () => { throw new Error('Not implemented yet') },
    inviteMember: async () => { throw new Error('Not implemented yet') },
    revokeInvite: async () => { throw new Error('Not implemented yet') },
    resendInvite: async () => { throw new Error('Not implemented yet') },
    promote: async () => { throw new Error('Not implemented yet') },
    demote: async () => { throw new Error('Not implemented yet') },
    transferOwnership: async () => { throw new Error('Not implemented yet') },
    updateProfile: async () => { throw new Error('Not implemented yet') },
    renameTeam: async () => { throw new Error('Not implemented yet') },
    updateTeam: async () => { throw new Error('Not implemented yet') },
    deleteTeam: async () => { throw new Error('Not implemented yet') },
    startImpersonation: async () => { throw new Error('Not implemented yet') },
    stopImpersonation: async () => { throw new Error('Not implemented yet') },
    getAvatarFallback: () => '',
    getTeamMembers: async () => [],
    updateMemberRole: async () => { throw new Error('Not implemented yet') },
    removeMember: async () => { throw new Error('Not implemented yet') },
    getTeamMemberProfile: async () => { throw new Error('Not implemented yet') },
    updateTeamMemberProfile: async () => { throw new Error('Not implemented yet') },
    sessionHealth: () => ({ isHealthy: true }),
    triggerSessionRecovery: async () => {},
    getActiveTabs: () => [],
    isTabPrimary: () => true,
    $initializationPromise: Promise.resolve(),
    refreshAuthState: async () => {
      if (currentUser.value) {
        await updateCompleteAuthState(currentUser.value as any)
      }
    },
  }
}

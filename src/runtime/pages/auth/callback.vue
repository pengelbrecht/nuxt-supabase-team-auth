<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ getStatusTitle() }}
          </h1>
        </div>
      </template>

      <div class="text-center space-y-4">
        <!-- Processing State -->
        <div
          v-if="status === 'processing'"
          class="space-y-4"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="animate-spin w-8 h-8 mx-auto text-primary-500"
          />
          <p class="text-gray-600 dark:text-gray-400">
            {{ getProcessingMessage() }}
          </p>
        </div>

        <!-- Success State -->
        <div
          v-else-if="status === 'success'"
          class="space-y-4"
        >
          <UIcon
            name="i-lucide-check-circle"
            class="w-8 h-8 mx-auto text-green-500"
          />
          <div>
            <p class="text-lg font-medium text-gray-900 dark:text-gray-100">
              {{ getSuccessMessage() }}
            </p>
            <p
              v-if="teamName"
              class="text-gray-600 dark:text-gray-400 mt-2"
            >
              Welcome to {{ teamName }}!
            </p>
          </div>
          <UButton
            size="lg"
            class="w-full justify-center"
            @click="goToDashboard"
          >
            Go to Dashboard
          </UButton>
        </div>

        <!-- Error State -->
        <div
          v-else-if="status === 'error'"
          class="space-y-4"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="w-8 h-8 mx-auto text-red-500"
          />
          <div>
            <p class="text-lg font-medium text-gray-900 dark:text-gray-100">
              Authentication Failed
            </p>
            <p class="text-gray-600 dark:text-gray-400 mt-2">
              {{ errorMessage }}
            </p>
          </div>
          <div class="space-y-2">
            <UButton
              size="lg"
              class="w-full"
              @click="goToDashboard"
            >
              Continue to Dashboard
            </UButton>
            <UButton
              variant="outline"
              size="lg"
              class="w-full"
              @click="goToSignin"
            >
              Try Again
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useTeamAuth } from '../../composables/useTeamAuth'

const route = useRoute()
const router = useRouter()

// Clean up OAuth hash after processing to prevent Vue Router warnings
// This is purely cosmetic - the warning doesn't break functionality
onMounted(() => {
  if (import.meta.client && window.location.hash.includes('access_token=')) {
    // Clean after a reasonable delay to ensure Supabase has processed the tokens
    setTimeout(() => {
      const cleanUrl = window.location.href.split('#')[0]
      window.history.replaceState({}, document.title, cleanUrl + window.location.search)
    }, 2000) // 2 second delay to be safe
  }
})

// Reactive state
const status = ref<'processing' | 'success' | 'error'>('processing')
const errorMessage = ref('')
const teamName = ref('')
const mode = ref<'signin' | 'signup' | 'unknown'>('unknown')

// Get the team auth composable
const { signUpWithTeam: _signUpWithTeam } = useTeamAuth()

// Get the Supabase client
const supabase = useSupabaseClient()

// Process the OAuth callback on page load
onMounted(async () => {
  try {
    // Extract query parameters
    const { mode: queryMode, team_name, error, error_description } = route.query

    // Check for OAuth errors first
    if (error) {
      throw new Error(error_description as string || error as string || 'OAuth authentication failed')
    }

    // Determine the flow mode
    mode.value = queryMode === 'signup' ? 'signup' : 'signin'

    console.log('OAuth callback - Mode:', mode.value, 'Team name:', team_name)

    // Wait for OAuth session to be established (simple polling - more reliable than events)
    let session = null
    let attempts = 0
    const maxAttempts = 10

    while (!session && attempts < maxAttempts) {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`)
      }

      session = currentSession

      if (!session) {
        console.log(`Waiting for OAuth session... (attempt ${attempts + 1}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }
    }

    if (!session) {
      throw new Error('No session found after OAuth redirect. Authentication may have failed.')
    }

    console.log('OAuth session established for user:', session.user.email)

    // Handle different modes
    if (mode.value === 'signup' && team_name) {
      await handleGoogleSignupWithTeam(session.user, team_name as string)
    }
    else if (mode.value === 'signin') {
      await handleGoogleSignin(session.user)
    }
    else {
      throw new Error('Invalid callback parameters. Missing mode or team name for signup.')
    }
  }
  catch (error: any) {
    console.error('OAuth callback error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'An unexpected error occurred during authentication'
  }
})

// Wait for team membership to be available (handles cloud database timing)
const waitForTeamMembership = async (session: any, maxAttempts = 10, delayMs = 500) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('role, teams!inner(id, name)')
        .eq('user_id', session.user.id)
        .single()

      if (!error && data) {
        console.log(`Team membership confirmed on attempt ${attempt}:`, data.role)
        return data
      }

      if (attempt < maxAttempts) {
        console.log(`Team membership not yet available, retrying in ${delayMs}ms... (attempt ${attempt}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    catch (error) {
      console.log(`Team membership check failed on attempt ${attempt}:`, error)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  console.warn('Team membership not confirmed after maximum attempts, proceeding anyway')
  return null
}

// Handle Google signup with team creation
const handleGoogleSignupWithTeam = async (user: any, teamNameParam: string) => {
  try {
    console.log('Processing Google signup with team creation for:', user.email)

    // Get the current session for authorization
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('No valid session found for team creation')
    }

    // Call the existing Edge Function for team creation
    // This will handle creating the team and adding the user as owner
    const response = await $fetch('/api/signup-with-team', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        email: user.email,
        team_name: teamNameParam,
        oauth_provider: 'google',
        user_metadata: user.user_metadata,
      },
    })

    if (response.success) {
      teamName.value = response.team?.name || teamNameParam
      console.log('Team created successfully:', teamName.value)

      // Wait for team membership to be available in the database
      await waitForTeamMembership(session)

      // Force refresh of auth state to load the new team data
      const { refreshAuthState } = useTeamAuth()
      await refreshAuthState()

      status.value = 'success'
    }
    else {
      throw new Error(response.message || 'Failed to create team')
    }
  }
  catch (error: any) {
    console.error('Google signup with team error:', error)
    throw new Error(`Team creation failed: ${error.message}`)
  }
}

// Handle Google signin for existing users
const handleGoogleSignin = async (user: any) => {
  try {
    console.log('Processing Google signin for existing user:', user.email)

    // For signin, we don't need to create anything
    // The user is already authenticated via OAuth
    // Just redirect to dashboard
    status.value = 'success'

    // Small delay to show success state
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  catch (error: any) {
    console.error('Google signin error:', error)
    throw new Error(`Sign in failed: ${error.message}`)
  }
}

// UI helper methods
const getStatusTitle = () => {
  if (status.value === 'processing') {
    return mode.value === 'signup' ? 'Creating Your Team...' : 'Signing You In...'
  }
  else if (status.value === 'success') {
    return mode.value === 'signup' ? 'Team Created!' : 'Welcome Back!'
  }
  else {
    return 'Authentication Error'
  }
}

const getProcessingMessage = () => {
  if (mode.value === 'signup') {
    return 'Creating your team and setting up your account...'
  }
  else {
    return 'Completing your sign in...'
  }
}

const getSuccessMessage = () => {
  if (mode.value === 'signup') {
    return 'Your team has been created successfully!'
  }
  else {
    return 'Successfully signed in with Google!'
  }
}

// Navigation methods
const goToDashboard = () => {
  router.push('/dashboard')
}

const goToSignin = () => {
  router.push('/signin')
}

// Set page meta
definePageMeta({
  layout: false, // Use no layout for this page
  auth: false, // Don't require auth since this IS the auth callback
})

// Define component name for ESLint
defineOptions({
  name: 'AuthCallback',
})
</script>

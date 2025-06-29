<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ getTitle() }}
          </h1>
          <p
            v-if="getSubtitle()"
            class="text-sm text-gray-600 dark:text-gray-400 mt-2"
          >
            {{ getSubtitle() }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <!-- Processing State -->
        <div
          v-if="status === 'processing'"
          class="text-center space-y-4"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="animate-spin w-8 h-8 mx-auto text-primary-500"
          />
          <p class="text-gray-600 dark:text-gray-400">
            Processing confirmation...
          </p>
        </div>

        <!-- Password Setup Form (for invitations) -->
        <PasswordSetupForm
          v-else-if="status === 'password-setup' && confirmationType === 'invite'"
          :email="userEmail"
          :team-name="teamName"
          @success="handlePasswordSetupSuccess"
          @error="handlePasswordSetupError"
        />

        <!-- Password Reset Form -->
        <ResetPasswordForm
          v-else-if="status === 'password-setup' && confirmationType === 'recovery'"
          @success="handlePasswordResetSuccess"
          @error="handlePasswordResetError"
        />

        <!-- Success State -->
        <div
          v-else-if="status === 'success'"
          class="text-center space-y-4"
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
              v-if="teamName && confirmationType === 'invite'"
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
          class="text-center space-y-4"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="w-8 h-8 mx-auto text-red-500"
          />
          <div>
            <p class="text-lg font-medium text-gray-900 dark:text-gray-100">
              {{ getErrorTitle() }}
            </p>
            <p class="text-gray-600 dark:text-gray-400 mt-2">
              {{ errorMessage }}
            </p>
          </div>
          <div class="space-y-2">
            <UButton
              variant="outline"
              size="lg"
              class="w-full"
              @click="goToSignin"
            >
              Go to Sign In
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabaseClient } from '#imports'
import PasswordSetupForm from '../../components/PasswordSetupForm.vue'
import ResetPasswordForm from '../../components/ResetPasswordForm.vue'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const session = useSupabaseSession()

// State management
const status = ref<'processing' | 'password-setup' | 'success' | 'error'>('processing')
const confirmationType = ref<'invite' | 'recovery' | 'email' | null>(null)
const errorMessage = ref('')
const teamName = ref('')
const teamId = ref('')
const userEmail = ref('')
const inviteRole = ref('member')

// Process the confirmation on mount
onMounted(async () => {
  try {
    // Debug: Log all URL information
    console.log('=== CONFIRMATION DEBUG ===')
    console.log('Full URL:', window.location.href)
    console.log('Query params:', route.query)
    console.log('Hash:', window.location.hash)
    console.log('========================')

    // Get URL parameters
    const { token_hash, type, error, error_description } = route.query

    // Check for errors first
    if (error) {
      throw new Error(error_description as string || error as string || 'Confirmation failed')
    }

    // Handle hash-based URLs (modern Supabase format)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const confirmType = hashParams.get('type')

      console.log('Hash params found:', { accessToken: !!accessToken, confirmType })

      if (accessToken && confirmType === 'invite') {
        // This is an invitation confirmation
        await handleInviteConfirmation()
        return
      }
      else if (accessToken && confirmType === 'recovery') {
        // This is a password reset confirmation
        await handlePasswordReset()
        return
      }
      else if (accessToken) {
        // Generic confirmation with access token - likely an invite
        console.log('Generic access token confirmation, treating as invite')
        await handleInviteConfirmation()
        return
      }
    }

    // Handle PKCE code confirmations (modern format)
    const { code } = route.query
    if (code) {
      console.log('PKCE code confirmation - waiting for @nuxtjs/supabase to process:', { code })

      // Wait for @nuxtjs/supabase to automatically process the PKCE code
      let attempts = 0
      const maxAttempts = 20
      const delayMs = 250

      while (!session.value && attempts < maxAttempts) {
        console.log(`Waiting for PKCE session... (attempt ${attempts + 1}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        attempts++
      }

      if (!session.value) {
        throw new Error('Failed to establish session from password reset code')
      }

      console.log('Session established from PKCE code:', session.value.user?.email)

      // This is a password reset confirmation
      await handlePasswordReset()
      return
    }

    // Handle token_hash confirmations (legacy format)
    if (token_hash) {
      console.log('Token hash confirmation:', { type })

      if (type === 'recovery') {
        await handlePasswordReset()
      }
      else if (type === 'invite' || type === 'signup') {
        await handleInviteConfirmation()
      }
      else {
        throw new Error('Unknown confirmation type')
      }
    }
    else {
      console.log('No valid confirmation parameters found')
      throw new Error('Invalid confirmation link')
    }
  }
  catch (error: any) {
    console.error('Confirmation error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'An unexpected error occurred'
  }
})

// Handle invitation confirmation
const handleInviteConfirmation = async () => {
  try {
    confirmationType.value = 'invite'

    console.log('Starting invitation confirmation...')

    // @nuxtjs/supabase's useSupabaseSession() is just reactive state - it doesn't establish sessions
    // We need to manually process the hash tokens and set the session
    console.log('Processing hash tokens manually...')

    // Extract tokens from hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    console.log('Hash tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    })

    let currentSession = null

    if (accessToken && refreshToken) {
      console.log('Setting session with hash tokens...')

      // Use setSession to establish the session with the tokens from the hash
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        console.error('setSession error:', error)
        throw new Error(`Failed to establish session: ${error.message}`)
      }

      currentSession = data.session
      console.log('Session established via setSession:', currentSession?.user?.email)
    }
    else {
      // Fallback: check if session already exists
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('getSession error:', sessionError)
        throw new Error(`Session error: ${sessionError.message}`)
      }

      currentSession = existingSession
      console.log('Using existing session:', currentSession?.user?.email)
    }

    if (!currentSession) {
      throw new Error('Unable to establish session. The invitation link may have expired or already been used.')
    }

    console.log('Session established for user:', currentSession.user?.email)

    // Extract user metadata and query params for team info
    const metadata = currentSession.user.user_metadata
    userEmail.value = currentSession.user.email || ''
    teamId.value = route.query.team_id as string || metadata?.team_id || ''
    teamName.value = metadata?.team_name || ''
    inviteRole.value = metadata?.role || 'member'

    if (!teamId.value) {
      throw new Error('Invalid invitation: missing team information')
    }

    // Get team name from database if not in metadata
    if (!teamName.value) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId.value)
        .single()

      if (team) {
        teamName.value = team.name
      }
    }

    // Check if user is already a member of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', currentSession.user.id)
      .eq('team_id', teamId.value)
      .single()

    if (membership) {
      // Already a member, redirect to dashboard
      status.value = 'success'
      setTimeout(() => router.push('/dashboard'), 1000)
      return
    }

    // Check if user has a strong password set (not auto-generated)
    // We'll require password setup for security
    const userCreatedAt = new Date(currentSession.user.created_at)
    const userConfirmedAt = new Date(currentSession.user.email_confirmed_at || currentSession.user.created_at)
    const timeDifference = Math.abs(userConfirmedAt.getTime() - userCreatedAt.getTime())

    // If user was just created via invitation (less than 5 minutes between creation and confirmation)
    // require password setup
    if (timeDifference < 5 * 60 * 1000) {
      console.log('New invited user - requiring password setup')
      status.value = 'password-setup'
    }
    else {
      // Existing user confirming invitation - just add to team
      await handlePasswordSetupSuccess()
    }
  }
  catch (error: any) {
    console.error('Invite confirmation error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'Failed to process invitation'
  }
}

// Handle password reset
const handlePasswordReset = async () => {
  try {
    confirmationType.value = 'recovery'

    // Wait for session to be established by @nuxtjs/supabase
    let attempts = 0
    const maxAttempts = 10
    const delayMs = 250

    while (!session.value && attempts < maxAttempts) {
      console.log(`Waiting for recovery session... (attempt ${attempts + 1}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
      attempts++
    }

    if (!session.value) {
      throw new Error('Invalid or expired password reset link')
    }

    // Show password reset form
    status.value = 'password-setup'
  }
  catch (error: any) {
    console.error('Password reset error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'Failed to process password reset'
  }
}

// Handle successful password setup for invitations
const handlePasswordSetupSuccess = async () => {
  try {
    // Add user to the team
    if (!session.value) {
      throw new Error('No valid session found')
    }

    // Call the accept-invite API to add user to team
    const response = await $fetch('/api/accept-invite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.value.access_token}`,
      },
      body: {
        team_id: teamId.value,
      },
    })

    if (response.success) {
      status.value = 'success'
    }
    else {
      throw new Error(response.error || 'Failed to join team')
    }
  }
  catch (error: any) {
    console.error('Team join error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'Failed to join team'
  }
}

// Handle password setup errors
const handlePasswordSetupError = (error: string) => {
  status.value = 'error'
  errorMessage.value = error
}

// Handle successful password reset
const handlePasswordResetSuccess = () => {
  status.value = 'success'
}

// Handle password reset errors
const handlePasswordResetError = (error: string) => {
  status.value = 'error'
  errorMessage.value = error
}

// UI helper methods
const getTitle = () => {
  switch (status.value) {
    case 'processing':
      return 'Processing Confirmation'
    case 'password-setup':
      return confirmationType.value === 'invite' ? 'Set Up Your Account' : 'Reset Your Password'
    case 'success':
      return confirmationType.value === 'invite' ? 'Welcome!' : 'Password Reset Complete'
    case 'error':
      return 'Confirmation Failed'
    default:
      return 'Confirmation'
  }
}

const getSubtitle = () => {
  if (status.value === 'password-setup' && confirmationType.value === 'invite') {
    return 'Please set a password to complete your account setup'
  }
  if (status.value === 'password-setup' && confirmationType.value === 'recovery') {
    return 'Enter your new password below'
  }
  return null
}

const getSuccessMessage = () => {
  if (confirmationType.value === 'invite') {
    return 'Your account has been set up successfully!'
  }
  else if (confirmationType.value === 'recovery') {
    return 'Your password has been reset successfully!'
  }
  return 'Confirmation successful!'
}

const getErrorTitle = () => {
  if (confirmationType.value === 'invite') {
    return 'Invitation Error'
  }
  else if (confirmationType.value === 'recovery') {
    return 'Password Reset Error'
  }
  return 'Confirmation Error'
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
  auth: false, // Don't require auth since this IS the auth confirmation
})

// Define component name for ESLint
defineOptions({
  name: 'AuthConfirm',
})
</script>

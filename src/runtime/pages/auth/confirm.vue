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
import PasswordSetupForm from '../../components/PasswordSetupForm.vue'
import ResetPasswordForm from '../../components/ResetPasswordForm.vue'

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()

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

    // First, try to exchange the code for a session if we have URL fragments
    if (window.location.hash) {
      console.log('Found hash fragment, attempting session exchange...')

      // Try exchangeCodeForSession first
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const code = hashParams.get('code')

      if (code) {
        console.log('Found auth code, exchanging for session...')
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.log('Code exchange error:', error)
        }
        else {
          console.log('Successfully exchanged code for session:', data.user?.email)
        }
      }
    }

    // Wait for the session to be established after email confirmation
    let session = null
    let attempts = 0
    const maxAttempts = 20 // Increased attempts
    const delayMs = 250 // Shorter delay

    console.log('Polling for session...')
    while (!session && attempts < maxAttempts) {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error on attempt', attempts + 1, ':', sessionError)
        // Don't throw immediately, keep trying
      }
      else {
        session = currentSession
      }

      if (!session) {
        console.log(`Waiting for invitation session... (attempt ${attempts + 1}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        attempts++
      }
      else {
        console.log('Session found!', session.user?.email)
      }
    }

    if (!session) {
      // Last attempt: try getting user directly
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userData.user && !userError) {
        console.log('Session polling failed but user exists, proceeding...')
        // Create a fake session structure for compatibility
        session = {
          user: userData.user,
          access_token: 'direct-user-access',
        }
      }
      else {
        throw new Error('Unable to establish session. The invitation link may have expired or already been used.')
      }
    }

    // Extract user metadata and query params for team info
    const metadata = session.user.user_metadata
    userEmail.value = session.user.email || ''
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
      .eq('user_id', session.user.id)
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
    const userCreatedAt = new Date(session.user.created_at)
    const userConfirmedAt = new Date(session.user.email_confirmed_at || session.user.created_at)
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

    // Verify the session exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
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
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No valid session found')
    }

    // Call the accept-invite API to add user to team
    const response = await $fetch('/api/accept-invite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
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

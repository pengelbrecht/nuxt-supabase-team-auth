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
          :session-data="sessionTokens"
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
import { $fetch } from 'ofetch'
import { useSupabaseClient, useSupabaseSession } from '../../composables/useSupabaseComposables'
import PasswordSetupForm from '../../components/PasswordSetupForm.vue'
import ResetPasswordForm from '../../components/ResetPasswordForm.vue'
import { useRoute, useRouter } from '#imports'

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
const currentSessionRef = ref(null as any)
const sessionTokens = ref<{ access_token: string, refresh_token: string } | undefined>()

// Process the confirmation on mount
onMounted(async () => {
  try {
    // Check if session already exists
    await supabase.auth.getSession()

    // Get URL parameters for non-hash confirmations
    const { token_hash, type, error, error_description } = route.query

    // Check for errors first
    if (error) {
      throw new Error(error_description as string || error as string || 'Confirmation failed')
    }

    // Handle hash-based invitations with streamlined approach
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Step 1: Parse tokens from URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const confirmType = hashParams.get('type')

      if (!accessToken || !refreshToken) {
        throw new Error('Missing access_token or refresh_token in invitation link')
      }

      try {
        // Step 2: Store tokens for components (no client setSession needed)
        sessionTokens.value = {
          access_token: accessToken,
          refresh_token: refreshToken,
        }

        // Step 3: Call sync-session API to set server-side cookies
        await $fetch('/api/auth/sync-session', {
          method: 'POST',
          body: {
            accessToken: accessToken,
            refreshToken: refreshToken,
          },
        })

        // Step 3.5: Refresh client session to pick up server-side cookies
        await supabase.auth.getSession()

        // Wait a moment for the session to propagate
        await new Promise(resolve => setTimeout(resolve, 100))

        // Step 4: Extract user info from JWT token for invitation processing
        let userInfo
        try {
          const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]))
          userInfo = {
            id: tokenPayload.sub,
            email: tokenPayload.email,
            user_metadata: tokenPayload.user_metadata || {},
            created_at: tokenPayload.iat ? new Date(tokenPayload.iat * 1000).toISOString() : new Date().toISOString(),
            email_confirmed_at: tokenPayload.iat ? new Date(tokenPayload.iat * 1000).toISOString() : new Date().toISOString(),
          }
        }
        catch {
          throw new Error('Invalid invitation token format')
        }

        // Step 5: Process invitation metadata from JWT
        const metadata = userInfo.user_metadata
        teamId.value = metadata?.team_id || ''
        teamName.value = metadata?.team_name || ''
        inviteRole.value = metadata?.role || 'member'
        userEmail.value = userInfo.email || ''

        if (!teamId.value) {
          throw new Error('Invalid invitation: missing team information')
        }

        // Step 6: Create session object for components (no setSession call)
        const sessionForComponents = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: userInfo,
        }
        currentSessionRef.value = sessionForComponents

        // Step 7: Clear the hash from URL for security
        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        // Step 8: Determine if password setup is needed
        const userCreatedAt = new Date(userInfo.created_at)
        const userConfirmedAt = new Date(userInfo.email_confirmed_at || userInfo.created_at)
        const timeDifference = Math.abs(userConfirmedAt.getTime() - userCreatedAt.getTime())

        // Step 9: Show appropriate UI based on invitation type
        if (confirmType === 'invite' || !confirmType) {
          if (timeDifference < 5 * 60 * 1000) {
            // New user - needs password setup
            confirmationType.value = 'invite'
            status.value = 'password-setup'
          }
          else {
            // Existing user - just add to team
            await handlePasswordSetupSuccess()
          }
        }
        else if (confirmType === 'recovery') {
          await handlePasswordReset()
        }
        else {
          throw new Error('Unknown confirmation type: ' + confirmType)
        }

        return // Success - exit early
      }
      catch (e: any) {
        console.error('Invitation processing failed:', e)

        // Set error state
        errorMessage.value = 'Failed to process invitation: ' + e.message
        status.value = 'error'
        return
      }
    }

    // Handle PKCE code confirmations (modern format)
    const { code } = route.query
    if (code) {
      // Wait for @nuxtjs/supabase to automatically process the PKCE code
      let attempts = 0
      const maxAttempts = 20
      const delayMs = 250

      while (!session.value && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        attempts++
      }

      if (!session.value) {
        throw new Error('Failed to establish session from password reset code')
      }

      // This is a password reset confirmation
      await handlePasswordReset()
      return
    }

    // Handle token_hash confirmations (legacy format)
    if (token_hash) {
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
      throw new Error('Invalid confirmation link')
    }
  }
  catch (error: any) {
    console.error('Confirmation error:', error)
    status.value = 'error'
    errorMessage.value = error.message || 'An unexpected error occurred'
  }
})

// Handle invitation confirmation (simplified - most logic moved to server)
const handleInviteConfirmation = async () => {
  try {
    confirmationType.value = 'invite'

    // Session and team info are already established by server processing
    if (!session.value) {
      throw new Error('No session available after invitation processing')
    }

    const currentSession = session.value
    currentSessionRef.value = currentSession

    // All team info should already be set by server processing
    if (!teamId.value) {
      throw new Error('Invalid invitation: missing team information')
    }

    // Check if user has a strong password set (not auto-generated)
    // We'll require password setup for security
    const userCreatedAt = new Date(currentSession.user.created_at)
    const userConfirmedAt = new Date(currentSession.user.email_confirmed_at || currentSession.user.created_at)
    const timeDifference = Math.abs(userConfirmedAt.getTime() - userCreatedAt.getTime())

    // If user was just created via invitation (less than 5 minutes between creation and confirmation)
    // require password setup
    if (timeDifference < 5 * 60 * 1000) {
      status.value = 'password-setup'
    }
    else {
      // Existing user confirming invitation - just add to team
      await handlePasswordSetupSuccess()
    }
  }
  catch (error: any) {
    console.error('Invitation confirmation error:', error)
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
    // Use the stored session data instead of session.value
    const activeSession = currentSessionRef.value

    if (!activeSession) {
      throw new Error('No valid session found for team join')
    }

    // Call the accept-invite API to add user to team
    const response = await $fetch('/api/accept-invite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`,
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
  // Use full page navigation to ensure server-side cookies are properly read
  window.location.href = '/dashboard'
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

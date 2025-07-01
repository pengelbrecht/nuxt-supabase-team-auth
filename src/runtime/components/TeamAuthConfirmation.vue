<template>
  <div class="flex justify-center items-center min-h-screen p-4">
    <UCard class="w-full max-w-md">
      <!-- Loading State -->
      <template v-if="isLoading">
        <div class="text-center space-y-4">
          <div class="flex justify-center">
            <svg
              class="animate-spin h-8 w-8 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p class="text-gray-600">
            {{ loadingMessage }}
          </p>
        </div>
      </template>

      <!-- Success State -->
      <template v-else-if="isSuccess">
        <div class="text-center space-y-4">
          <div class="text-4xl">
            ✅
          </div>
          <h2 class="text-xl font-semibold text-gray-900">
            {{ successTitle }}
          </h2>
          <p class="text-gray-600">
            {{ successMessage }}
          </p>
          <UButton
            v-if="redirectUrl"
            color="primary"
            size="lg"
            class="w-full"
            @click="handleRedirect"
          >
            Continue
          </UButton>
        </div>
      </template>

      <!-- Error State -->
      <template v-else-if="error">
        <div class="text-center space-y-4">
          <div class="text-4xl">
            ❌
          </div>
          <h2 class="text-xl font-semibold text-gray-900">
            {{ errorTitle }}
          </h2>
          <p class="text-gray-600">
            {{ error }}
          </p>
          <UButton
            color="red"
            size="lg"
            class="w-full"
            @click="retryConfirmation"
          >
            Try Again
          </UButton>
        </div>
      </template>

      <!-- Invalid/Missing Parameters -->
      <template v-else>
        <div class="text-center space-y-4">
          <div class="text-4xl">
            ⚠️
          </div>
          <h2 class="text-xl font-semibold text-gray-900">
            Invalid Confirmation Link
          </h2>
          <div class="space-y-2">
            <p class="text-gray-600">
              This confirmation link appears to be invalid or has expired.
            </p>
            <p class="text-gray-600">
              Please check your email for a fresh link or contact support.
            </p>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from '#app'

interface ConfirmationProps {
  /** Custom redirect URL after successful confirmation */
  redirectUrl?: string
}

const props = withDefaults(defineProps<ConfirmationProps>(), {
  redirectUrl: '/',
})

const route = useRoute()
const router = useRouter()

// Get debug mode from team auth config
const { debug: debugMode } = useTeamAuthConfig()

// State management
const isLoading = ref(true)
const isSuccess = ref(false)
const error = ref<string | null>(null)
const confirmationType = ref<'email' | 'invite' | null>(null)
const loadingMessage = ref('Processing confirmation...')

// Success/Error messages
const successTitle = computed(() => {
  switch (confirmationType.value) {
    case 'email':
      return 'Email Confirmed!'
    case 'invite':
      return 'Invitation Accepted!'
    default:
      return 'Confirmation Complete!'
  }
})

const successMessage = computed(() => {
  switch (confirmationType.value) {
    case 'email':
      return 'Your email has been confirmed. You can now sign in to your account.'
    case 'invite':
      return 'You have successfully joined the team. Welcome aboard!'
    default:
      return 'Your confirmation has been processed successfully.'
  }
})

const errorTitle = computed(() => {
  switch (confirmationType.value) {
    case 'email':
      return 'Email Confirmation Failed'
    case 'invite':
      return 'Invitation Acceptance Failed'
    default:
      return 'Confirmation Failed'
  }
})

// Extract parameters from URL (query or hash)
const extractParameters = () => {
  const queryParams = route.query
  const hashParams = new URLSearchParams(window.location.hash.substring(1))

  // Priority: query params first, then hash params (fallback for email clients)
  const getParam = (key: string) => {
    return queryParams[key] || hashParams.get(key)
  }

  return {
    token: getParam('token'),
    type: getParam('type'),
    email: getParam('email'),
    team_id: getParam('team_id'),
    redirect_to: getParam('redirect_to'),
  }
}

// Determine confirmation type
const determineConfirmationType = (params: any) => {
  if (params.type === 'invite' || params.team_id) {
    return 'invite'
  }
  else if (params.type === 'signup' || params.type === 'email') {
    return 'email'
  }
  return null
}

// Handle email confirmation
const handleEmailConfirmation = async (params: any) => {
  loadingMessage.value = 'Confirming your email address...'

  try {
    // Use Supabase auth to verify the token
    const { $teamAuthClient } = useNuxtApp()

    if (!params.token) {
      throw new Error('Missing confirmation token')
    }

    // Verify OTP token for email confirmation
    const { error: verifyError } = await $teamAuthClient.auth.verifyOtp({
      token_hash: params.token,
      type: 'email',
    })

    if (verifyError) {
      throw new Error(verifyError.message)
    }

    confirmationType.value = 'email'
    isSuccess.value = true
  }
  catch (err: any) {
    error.value = err.message || 'Failed to confirm email address'
  }
}

// Handle invitation acceptance
const handleInviteAcceptance = async (params: any) => {
  loadingMessage.value = 'Accepting team invitation...'

  try {
    if (!params.team_id) {
      throw new Error('Missing team information')
    }

    // Call accept-invite Edge Function
    const { $teamAuthClient } = useNuxtApp()

    const { data, error: inviteError } = await $teamAuthClient.functions.invoke('accept-invite', {
      body: {
        team_id: params.team_id,
        email: params.email,
      },
    })

    if (inviteError) {
      throw new Error(inviteError.message)
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to accept invitation')
    }

    confirmationType.value = 'invite'
    isSuccess.value = true
  }
  catch (err: any) {
    error.value = err.message || 'Failed to accept team invitation'
  }
}

// Main confirmation handler
const processConfirmation = async () => {
  try {
    const params = extractParameters()

    if (debugMode.value) {
      console.log('Confirmation parameters:', params)
    }

    const type = determineConfirmationType(params)

    if (!type) {
      error.value = 'Unable to determine confirmation type'
      return
    }

    if (type === 'email') {
      confirmationType.value = 'email'
      await handleEmailConfirmation(params)
    }
    else if (type === 'invite') {
      confirmationType.value = 'invite'
      await handleInviteAcceptance(params)
    }
  }
  catch (err: any) {
    error.value = err.message || 'An unexpected error occurred'
  }
  finally {
    isLoading.value = false
  }
}

// Retry confirmation
const retryConfirmation = () => {
  isLoading.value = true
  isSuccess.value = false
  error.value = null
  processConfirmation()
}

// Handle redirect after success
const handleRedirect = () => {
  const redirectTo = route.query.redirect_to as string || props.redirectUrl
  router.push(redirectTo)
}

// Initialize on mount
onMounted(() => {
  processConfirmation()
})
</script>

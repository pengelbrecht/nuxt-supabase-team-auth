<template>
  <UCard :class="cardClass">
    <template
      v-if="title || subtitle"
      #header
    >
      <slot name="header">
        <div class="text-center">
          <h2
            v-if="title"
            class="text-2xl font-semibold text-gray-900 dark:text-gray-100"
          >
            {{ title }}
          </h2>
          <p
            v-if="subtitle"
            class="text-sm text-gray-600 dark:text-gray-400 mt-2"
          >
            {{ subtitle }}
          </p>
        </div>
      </slot>
    </template>

    <UForm
      :schema="signUpSchema"
      :state="form"
      class="space-y-6"
      @submit="handleSignUp"
    >
      <div class="space-y-4">
        <!-- Team Name Field -->
        <UFormField
          label="Team name"
          name="teamName"
          required
          :help="teamNameHelp"
        >
          <UInput
            v-model="form.teamName"
            type="text"
            placeholder="Enter your team name"
            :disabled="isLoading"
            icon="i-heroicons-user-group"
            size="lg"
          />
        </UFormField>

        <!-- Social Login Buttons -->
        <div
          v-if="showSocialSection"
          class="space-y-3"
        >
          <div class="text-center">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Choose how you'd like to create your team
            </p>
          </div>

          <slot name="social-buttons">
            <UButton
              v-if="showGoogleAuth"
              type="button"
              variant="outline"
              size="lg"
              block
              :disabled="isLoading || !form.teamName.trim() || isGoogleLoading"
              :loading="isGoogleLoading"
              class="justify-center"
              @click="handleGoogleSignUp"
            >
              <template #leading>
                <Icon
                  name="logos:google-icon"
                  class="w-5 h-5"
                />
              </template>
              Create "{{ form.teamName || 'team' }}" with Google
            </UButton>

            <UButton
              v-if="showGithubAuth"
              type="button"
              variant="outline"
              size="lg"
              block
              :disabled="isLoading || !form.teamName.trim() || isGithubLoading"
              :loading="isGithubLoading"
              class="justify-center"
              @click="handleGithubSignUp"
            >
              <template #leading>
                <Icon
                  name="logos:github-icon"
                  class="w-5 h-5"
                />
              </template>
              Create "{{ form.teamName || 'team' }}" with GitHub
            </UButton>
          </slot>
        </div>

        <!-- Divider -->
        <div
          v-if="showSocialSection"
          class="flex items-center my-6"
        >
          <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
          <div class="font-medium text-gray-500 dark:text-gray-400 flex mx-3 whitespace-nowrap">
            <span class="text-sm">Or create with email</span>
          </div>
          <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
        </div>

        <!-- Email Field -->
        <UFormField
          label="Email address"
          name="email"
          required
        >
          <UInput
            v-model="form.email"
            type="email"
            placeholder="Enter your email"
            autocomplete="email"
            :disabled="isLoading"
            icon="i-heroicons-envelope"
            size="lg"
          />
        </UFormField>

        <!-- Password Field -->
        <UFormField
          label="Password"
          name="password"
          required
          :help="passwordHelp"
        >
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Create a password"
            autocomplete="new-password"
            :disabled="isLoading"
            icon="i-heroicons-lock-closed"
            size="lg"
            :ui="{ trailing: { padding: { sm: 'pe-2' } } }"
          >
            <template #trailing>
              <UButton
                type="button"
                variant="ghost"
                size="sm"
                color="gray"
                :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <!-- Password Confirmation Field -->
        <UFormField
          label="Confirm password"
          name="confirmPassword"
          required
        >
          <UInput
            v-model="form.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Confirm your password"
            autocomplete="new-password"
            :disabled="isLoading"
            icon="i-heroicons-lock-closed"
            size="lg"
            :ui="{ trailing: { padding: { sm: 'pe-2' } } }"
          >
            <template #trailing>
              <UButton
                type="button"
                variant="ghost"
                size="sm"
                color="gray"
                :icon="showConfirmPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                @click="showConfirmPassword = !showConfirmPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <!-- Terms and Privacy -->
        <div
          v-if="requireTermsAcceptance"
          class="space-y-3"
        >
          <UCheckbox
            v-model="form.acceptTerms"
            required
            :disabled="isLoading"
          >
            <template #label>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                I agree to the
                <slot name="terms-link">
                  <UButton
                    variant="ghost"
                    size="sm"
                    class="p-0 h-auto text-primary-600 hover:text-primary-500"
                    @click="$emit('view-terms')"
                  >
                    Terms of Service
                  </UButton>
                </slot>
                and
                <slot name="privacy-link">
                  <UButton
                    variant="ghost"
                    size="sm"
                    class="p-0 h-auto text-primary-600 hover:text-primary-500"
                    @click="$emit('view-privacy')"
                  >
                    Privacy Policy
                  </UButton>
                </slot>
              </span>
            </template>
          </UCheckbox>

          <UCheckbox
            v-if="showMarketingConsent"
            v-model="form.marketingConsent"
            :disabled="isLoading"
          >
            <template #label>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                I'd like to receive product updates and marketing emails
              </span>
            </template>
          </UCheckbox>
        </div>

        <!-- Error Alert -->
        <UAlert
          v-if="errorMessage"
          color="red"
          variant="subtle"
          :title="getErrorTitle(errorMessage)"
          :description="getErrorDescription(errorMessage)"
          :close-button="{ icon: 'i-lucide-x', color: 'gray', variant: 'ghost' }"
          @close="errorMessage = ''"
        />
      </div>

      <!-- Submit Button -->
      <UButton
        type="submit"
        :loading="isLoading"
        color="primary"
        size="lg"
        block
      >
        Create "{{ form.teamName || 'team' }}" with email
      </UButton>
    </UForm>

    <template #footer>
      <slot name="footer">
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?
          <UButton
            type="button"
            variant="ghost"
            size="sm"
            :disabled="isLoading"
            class="font-medium text-primary-600 hover:text-primary-500"
            @click="$emit('switch-to-signin')"
          >
            Sign in
          </UButton>
        </div>
      </slot>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useTeamAuth } from '../composables/useTeamAuth'
import { useTeamAuthConfig } from '../composables/useTeamAuthConfig'
import type { User, Team } from '../types'
import { useNuxtApp } from '#app'

interface AuthSignUpProps {
  /** Title displayed in the header */
  title?: string
  /** Subtitle displayed under the title */
  subtitle?: string
  /** Custom CSS classes for the card */
  cardClass?: string
  /** Submit button text */
  submitText?: string
  /** Auto-focus the team name field on mount */
  autoFocus?: boolean
  /** Show social login buttons */
  showSocialLogin?: boolean
  /** Enable Google authentication */
  googleAuth?: boolean
  /** Enable GitHub authentication */
  githubAuth?: boolean
  /** Require terms and privacy acceptance */
  requireTermsAcceptance?: boolean
  /** Show marketing consent checkbox */
  showMarketingConsent?: boolean
  /** Help text for team name field */
  teamNameHelp?: string
  /** Help text for password field */
  passwordHelp?: string
}

interface SignUpForm {
  teamName: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
  marketingConsent: boolean
}

const props = withDefaults(defineProps<AuthSignUpProps>(), {
  title: 'Create your team',
  subtitle: 'Choose your team name and preferred signup method.',
  cardClass: 'w-full max-w-md',
  submitText: 'Create team',
  autoFocus: true,
  showSocialLogin: true,
  googleAuth: true,
  githubAuth: false,
  requireTermsAcceptance: true,
  showMarketingConsent: true,
  teamNameHelp: 'This will be your team workspace name regardless of signup method',
  passwordHelp: 'Must be at least 8 characters with numbers and letters',
})

const emit = defineEmits<{
  'success': [data: { user: User, team: Team }]
  'error': [error: string]
  'switch-to-signin': []
  'view-terms': []
  'view-privacy': []
  'social-success': [provider: string, data: unknown]
  'social-error': [provider: string, error: string]
}>()

// Form state - must be declared first
const form = reactive<SignUpForm>({
  teamName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  marketingConsent: false,
})

// Custom validation for password confirmation
const passwordMatchValidation = v.pipe(
  v.string(),
  v.check((val) => {
    return val === form.password
  }, 'Passwords do not match'),
)

// Validation schema using Valibot
const signUpSchema = v.object({
  teamName: v.pipe(
    v.string(),
    v.minLength(2, 'Team name must be at least 2 characters'),
    v.maxLength(50, 'Team name must be less than 50 characters'),
  ),
  email: v.pipe(v.string(), v.email('Please enter a valid email address')),
  password: v.pipe(
    v.string(),
    v.minLength(8, 'Password must be at least 8 characters'),
    v.regex(/(?=.*[a-z])(?=.*\d)/i, 'Password must contain both letters and numbers'),
  ),
  confirmPassword: passwordMatchValidation,
  acceptTerms: v.literal(true, 'You must accept the terms and conditions'),
  marketingConsent: v.optional(v.boolean()),
})

// Composables - declared after form to avoid issues
const { signUpWithTeam } = useTeamAuth()
const { isGoogleEnabled, isGithubEnabled, hasAnySocialProvider } = useTeamAuthConfig()

// Computed properties for social auth
const showGoogleAuth = computed(() => props.googleAuth && isGoogleEnabled.value)
const showGithubAuth = computed(() => props.githubAuth && isGithubEnabled.value)
const showSocialSection = computed(() => props.showSocialLogin && hasAnySocialProvider.value && (showGoogleAuth.value || showGithubAuth.value))

// UI state
const isLoading = ref(false)
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const errorMessage = ref('')

// Sign up handlers
const handleSignUp = async (event: FormSubmitEvent<any>) => {
  try {
    isLoading.value = true

    await signUpWithTeam(event.data.email, event.data.password, event.data.teamName)

    emit('success', {
      user: { email: event.data.email },
      team: { name: event.data.teamName },
      marketingConsent: event.data.marketingConsent,
    })

    // Clear form on success
    Object.assign(form, {
      teamName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      marketingConsent: false,
    })
  }
  catch (error: unknown) {
    console.error('Signup error:', error)
    errorMessage.value = error.message || 'Failed to create account'
    emit('error', errorMessage.value)
  }
  finally {
    isLoading.value = false
  }
}

// Social login handlers
const handleGoogleSignUp = async () => {
  try {
    isGoogleLoading.value = true

    // Get Supabase client
    const nuxtApp = useNuxtApp()

    if (!nuxtApp?.$teamAuthClient?.auth?.signInWithOAuth) {
      throw new Error('Supabase client not available for OAuth')
    }

    const { data, error } = await nuxtApp.$teamAuthClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?mode=signup&team_name=${encodeURIComponent(form.teamName || 'My Team')}`,
      },
    })

    if (error) {
      throw error
    }

    emit('social-success', 'google', data)
  }
  catch (error: unknown) {
    const errorMessage = error.message || 'Failed to sign up with Google'
    emit('social-error', 'google', errorMessage)
  }
  finally {
    isGoogleLoading.value = false
  }
}

const handleGithubSignUp = async () => {
  try {
    isGithubLoading.value = true

    // Get Supabase client
    const nuxtApp = useNuxtApp()

    if (!nuxtApp?.$teamAuthClient?.auth?.signInWithOAuth) {
      throw new Error('Supabase client not available for OAuth')
    }

    const { data, error } = await nuxtApp.$teamAuthClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?mode=signup&team_name=${encodeURIComponent(form.teamName || 'My Team')}`,
      },
    })

    if (error) {
      throw error
    }

    emit('social-success', 'github', data)
  }
  catch (error: unknown) {
    const errorMessage = error.message || 'Failed to sign up with GitHub'
    emit('social-error', 'github', errorMessage)
  }
  finally {
    isGithubLoading.value = false
  }
}

// Error message helpers
const getErrorTitle = (error: string): string => {
  if (error.includes('EMAIL_ALREADY_EXISTS') || error.includes('already been registered')) {
    return 'Email Already Registered'
  }
  if (error.includes('TEAM_EXISTS') || error.includes('Team name already in use')) {
    return 'Team Name Unavailable'
  }
  if (error.includes('Failed to create user account')) {
    return 'Account Creation Failed'
  }
  if (error.includes('TEAM_CREATION_FAILED')) {
    return 'Team Creation Failed'
  }
  return 'Signup Failed'
}

const getErrorDescription = (error: string): string => {
  if (error.includes('EMAIL_ALREADY_EXISTS') || error.includes('already been registered')) {
    return 'This email address is already associated with an account. Please try signing in instead.'
  }
  if (error.includes('TEAM_EXISTS') || error.includes('Team name already in use')) {
    return 'This team name is already taken. Please choose a different name for your team.'
  }
  if (error.includes('TEAM_CREATION_FAILED')) {
    return 'We encountered an issue creating your team. Please check your information and try again.'
  }
  if (error.includes('Failed to create user account')) {
    return 'There was a problem creating your account. Please check your information and try again.'
  }
  return error || 'An unexpected error occurred. Please try again.'
}

// Auto-focus team name field
onMounted(() => {
  if (props.autoFocus) {
    nextTick(() => {
      const teamNameInput = document.querySelector('input[placeholder="Enter your team name"]') as HTMLInputElement
      teamNameInput?.focus()
    })
  }
})

// Clear error when user starts typing
const clearErrorOnInput = () => {
  if (errorMessage.value) {
    errorMessage.value = ''
  }
}

// Watch form changes to clear errors
watch(() => [form.email, form.teamName], clearErrorOnInput)
</script>

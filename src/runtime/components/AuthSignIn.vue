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

    <!-- Social Login Buttons -->
    <div
      v-if="showSocialSection"
      class="space-y-3 mb-4"
    >
      <slot name="social-buttons">
        <UButton
          v-if="showGoogleAuth"
          type="button"
          variant="outline"
          size="lg"
          block
          :disabled="isLoading"
          :loading="isGoogleLoading"
          class="justify-center"
          @click="handleGoogleSignIn"
        >
          <template #leading>
            <Icon
              name="logos:google-icon"
              class="w-5 h-5"
            />
          </template>
          Continue with Google
        </UButton>
      </slot>
    </div>

    <!-- Divider -->
    <div
      v-if="showSocialSection"
      class="flex items-center my-8"
    >
      <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
      <div class="font-medium text-gray-500 dark:text-gray-400 flex mx-3 whitespace-nowrap">
        <span class="text-sm">Or continue with email</span>
      </div>
      <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
    </div>

    <!-- Error Alert from URL parameter -->
    <UAlert
      v-if="urlErrorMessage"
      color="error"
      variant="subtle"
      :title="urlErrorTitle"
      :description="urlErrorMessage"
      :close-button="{ icon: 'i-lucide-x', color: 'neutral', variant: 'ghost' }"
      class="mb-6"
      @close="clearUrlError"
    />

    <UForm
      v-if="isFormReady"
      :schema="authSchema"
      :state="form"
      class="space-y-6"
      @submit="handleSignIn"
    >
      <div class="space-y-4">
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
        >
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter your password"
            autocomplete="current-password"
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
                color="neutral"
                tabindex="-1"
                :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <!-- Remember Me & Forgot Password -->
        <div class="flex items-center justify-between">
          <UCheckbox
            v-if="showRememberMe && isFormReady"
            v-model="form.rememberMe"
            label="Remember me"
            :disabled="isLoading"
          />
          <div v-else />

          <slot name="forgot-password">
            <UButton
              type="button"
              variant="ghost"
              size="sm"
              :disabled="isLoading"
              @click="$emit('forgot-password')"
            >
              Forgot password?
            </UButton>
          </slot>
        </div>
      </div>

      <!-- Submit Button -->
      <UButton
        type="submit"
        :loading="isLoading"
        color="primary"
        size="lg"
        block
      >
        {{ submitText }}
      </UButton>
    </UForm>

    <template #footer>
      <slot name="footer">
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?
          <UButton
            type="button"
            variant="ghost"
            size="sm"
            :disabled="isLoading"
            class="font-medium text-primary-600 hover:text-primary-500"
            @click="$emit('switch-to-signup')"
          >
            Sign up
          </UButton>
        </div>
      </slot>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useSupabaseClient } from '../composables/useSupabaseComposables'
import { useTeamAuth } from '../composables/useTeamAuth'
import { useTeamAuthConfig } from '../composables/useTeamAuthConfig'
import { useRoute, useRouter, navigateTo, useRuntimeConfig } from '#imports'

interface AuthSignInProps {
  /** Title displayed in the header */
  title?: string
  /** Subtitle displayed under the title */
  subtitle?: string
  /** Custom CSS classes for the card */
  cardClass?: string
  /** Submit button text */
  submitText?: string
  /** Auto-focus the email field on mount */
  autoFocus?: boolean
  /** Show social login buttons */
  showSocialLogin?: boolean
  /** Enable Google authentication */
  googleAuth?: boolean
  /** Show remember me checkbox */
  showRememberMe?: boolean
}

interface SignInForm {
  email: string
  password: string
  rememberMe: boolean
}

const props = withDefaults(defineProps<AuthSignInProps>(), {
  title: 'Sign In',
  subtitle: 'Welcome back! Please sign in to your account.',
  cardClass: 'w-full max-w-md',
  submitText: 'Sign In',
  autoFocus: true,
  showSocialLogin: true,
  googleAuth: true,
  showRememberMe: true,
})

const emit = defineEmits<{
  'success': [user: any]
  'error': [error: string]
  'forgot-password': []
  'switch-to-signup': []
  'social-success': [provider: string, user: any]
  'social-error': [provider: string, error: string]
}>()

// Form state - must be declared first
const form = reactive<SignInForm>({
  email: '',
  password: '',
  rememberMe: false,
})

// Add a computed to ensure form is available
const isFormReady = computed(() => form && typeof form === 'object')

// Validation schema using Valibot
const authSchema = v.object({
  email: v.pipe(v.string(), v.email('Please enter a valid email address')),
  password: v.pipe(v.string(), v.minLength(6, 'Password must be at least 6 characters')),
  rememberMe: v.optional(v.boolean()),
})

// Composables - declared after form to avoid issues
const { signIn, isLoading } = useTeamAuth()
const { isGoogleEnabled, hasAnySocialProvider } = useTeamAuthConfig()
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

// Computed properties for social auth
const showGoogleAuth = computed(() => props.googleAuth && isGoogleEnabled.value)
const showSocialSection = computed(() => props.showSocialLogin && hasAnySocialProvider.value && showGoogleAuth.value)

// UI state
const isGoogleLoading = ref(false)
const showPassword = ref(false)

// URL error handling (from middleware redirects)
const urlErrorMessage = ref('')
const urlErrorTitle = ref('')

// Check for error parameter in URL on mount
onMounted(() => {
  const errorParam = route.query.error as string
  if (errorParam) {
    switch (errorParam) {
      case 'account_misconfigured':
        urlErrorTitle.value = 'Account Configuration Error'
        urlErrorMessage.value = 'Your account appears to be missing required data. Please contact support for assistance.'
        break
      default:
        urlErrorTitle.value = 'Authentication Error'
        urlErrorMessage.value = 'An error occurred during authentication. Please try again.'
    }
  }
})

const clearUrlError = () => {
  urlErrorMessage.value = ''
  urlErrorTitle.value = ''
  // Clean up URL parameter
  const query = { ...route.query }
  delete query.error
  router.replace({ query })
}

// Form validation
const _isFormValid = computed(() => {
  try {
    v.parse(authSchema, form)
    return true
  }
  catch {
    return false
  }
})

// Sign in handlers
const handleSignIn = async (event: FormSubmitEvent<any>) => {
  try {
    // signIn() now waits for auth state to be ready
    await signIn(event.data.email, event.data.password)

    emit('success', {
      email: event.data.email,
      rememberMe: event.data.rememberMe,
    })

    // Clear form on success
    form.email = ''
    form.password = ''
    form.rememberMe = false

    // Handle redirect - auth state is now guaranteed to be ready
    const redirectTo = route.query.redirect as string
    const teamAuthConfig = config.public.teamAuth || {}
    const defaultRedirect = teamAuthConfig.redirectTo || '/dashboard'

    let targetUrl = defaultRedirect

    if (redirectTo) {
      // Validate redirect URL for security (same-origin only)
      try {
        const url = new URL(redirectTo, window.location.origin)
        if (url.origin === window.location.origin) {
          targetUrl = redirectTo
        }
      }
      catch {
        // Invalid URL, use default
      }
    }

    // Use navigateTo for proper Nuxt navigation
    await navigateTo(targetUrl)
  }
  catch (error: any) {
    const errorMessage = error.message || 'Failed to sign in'
    emit('error', errorMessage)
  }
}

// Social login handlers
const handleGoogleSignIn = async () => {
  try {
    isGoogleLoading.value = true

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }

    emit('social-success', 'google', data)
  }
  catch (error: any) {
    const errorMessage = error.message || 'Failed to sign in with Google'
    emit('social-error', 'google', errorMessage)
  }
  finally {
    isGoogleLoading.value = false
  }
}

// Auto-focus email field
onMounted(() => {
  if (props.autoFocus) {
    nextTick(() => {
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      emailInput?.focus()
    })
  }
})
</script>

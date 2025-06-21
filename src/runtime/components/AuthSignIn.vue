<template>
  <UCard :class="cardClass">
    <template #header>
      <slot name="header">
        <div class="text-center">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
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
      v-if="showSocialLogin"
      class="space-y-3 mb-4"
    >
      <slot name="social-buttons">
        <UButton
          v-if="googleAuth"
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

        <UButton
          v-if="githubAuth"
          type="button"
          variant="outline"
          size="lg"
          block
          :disabled="isLoading"
          :loading="isGithubLoading"
          class="justify-center"
          @click="handleGithubSignIn"
        >
          <template #leading>
            <Icon
              name="logos:github-icon"
              class="w-5 h-5"
            />
          </template>
          Continue with GitHub
        </UButton>
      </slot>
    </div>

    <!-- Divider -->
    <div
      v-if="showSocialLogin"
      class="flex items-center my-8"
    >
      <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
      <div class="font-medium text-gray-500 dark:text-gray-400 flex mx-3 whitespace-nowrap">
        <span class="text-sm">Or continue with email</span>
      </div>
      <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
    </div>

    <UForm
      v-if="isFormReady"
      :schema="authSchema"
      :state="form"
      class="space-y-4"
      @submit="handleSignIn"
    >
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
              color="gray"
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

      <!-- Submit Button -->
      <UButton
        type="submit"
        :loading="isLoading"
        color="primary"
        size="lg"
        block
        class="mt-6"
      >
        {{ submitText }}
      </UButton>
    </UForm>

    <template #footer>
      <slot name="footer">
        <div class="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
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
import { useTeamAuth } from '../composables/useTeamAuth'

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
  /** Enable GitHub authentication */
  githubAuth?: boolean
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
  githubAuth: false,
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

// UI state
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)
const showPassword = ref(false)

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
    await signIn(event.data.email, event.data.password)

    emit('success', {
      email: event.data.email,
      rememberMe: event.data.rememberMe,
    })

    // Clear form on success
    form.email = ''
    form.password = ''
    form.rememberMe = false
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

    // Get Supabase client
    const nuxtApp = useNuxtApp()

    if (!nuxtApp?.$teamAuthClient?.auth?.signInWithOAuth) {
      throw new Error('Supabase client not available for OAuth')
    }

    const { data, error } = await nuxtApp.$teamAuthClient.auth.signInWithOAuth({
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

const handleGithubSignIn = async () => {
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
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }

    emit('social-success', 'github', data)
  }
  catch (error: any) {
    const errorMessage = error.message || 'Failed to sign in with GitHub'
    emit('social-error', 'github', errorMessage)
  }
  finally {
    isGithubLoading.value = false
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

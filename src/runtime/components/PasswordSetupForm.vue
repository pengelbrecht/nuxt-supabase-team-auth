<template>
  <div class="space-y-6">
    <!-- Alert for messages -->
    <UAlert
      v-if="message"
      :color="messageType"
      :title="messageType === 'error' ? 'Error' : 'Success'"
      :description="message"
      :icon="messageType === 'error' ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-check-circle'"
    />

    <!-- User info display -->
    <div
      v-if="email"
      class="text-center space-y-2 py-6 mb-2 border-b border-gray-200 dark:border-gray-700"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Setting up account for:
      </p>
      <p class="font-medium text-gray-900 dark:text-gray-100">
        {{ email }}
      </p>
      <p
        v-if="teamName"
        class="text-sm text-gray-600 dark:text-gray-400 mb-4"
      >
        Joining team: <span class="font-medium">{{ teamName }}</span>
      </p>
    </div>

    <!-- Password Setup Form -->
    <UForm
      :schema="passwordSchema"
      :state="form"
      class="space-y-4"
      @submit="handlePasswordSetup"
    >
      <!-- Password Field -->
      <UFormField
        label="Password"
        name="password"
        required
        :description="passwordHelpText"
      >
        <UInput
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your password"
          autocomplete="new-password"
          :disabled="isLoading"
          icon="i-heroicons-lock-closed"
          size="lg"
          tabindex="1"
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

      <!-- Confirm Password Field -->
      <UFormField
        label="Confirm Password"
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
          tabindex="2"
          :ui="{ trailing: { padding: { sm: 'pe-2' } } }"
        >
          <template #trailing>
            <UButton
              type="button"
              variant="ghost"
              size="sm"
              color="neutral"
              tabindex="-1"
              :icon="showConfirmPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
              @click="showConfirmPassword = !showConfirmPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <!-- Full Name Field (optional for profile) -->
      <UFormField
        label="Full Name"
        name="fullName"
        description="Optional - you can update this later"
      >
        <UInput
          v-model="form.fullName"
          placeholder="Enter your full name"
          :disabled="isLoading"
          icon="i-heroicons-user"
          size="lg"
          tabindex="3"
        />
      </UFormField>

      <!-- Submit Button -->
      <UButton
        type="submit"
        :loading="isLoading"
        color="primary"
        size="lg"
        block
        class="mt-6"
      >
        Set Password & Join Team
      </UButton>
    </UForm>

    <!-- Social Login Alternative -->
    <div
      v-if="showSocialSection"
      class="space-y-4"
    >
      <!-- Divider -->
      <div class="flex items-center">
        <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
        <div class="font-medium text-gray-500 dark:text-gray-400 flex mx-3 whitespace-nowrap">
          <span class="text-sm">Or continue with</span>
        </div>
        <div class="flex-1 border-t border-gray-300 dark:border-gray-600" />
      </div>

      <!-- Google Button -->
      <UButton
        v-if="showGoogleAuth"
        type="button"
        variant="outline"
        size="lg"
        block
        :disabled="isLoading"
        :loading="isGoogleLoading"
        class="justify-center"
        @click="handleGoogleLink"
      >
        <template #leading>
          <Icon
            name="logos:google-icon"
            class="w-5 h-5"
          />
        </template>
        Link Google Account Instead
      </UButton>

      <!-- GitHub Button -->
      <UButton
        v-if="showGithubAuth"
        type="button"
        variant="outline"
        size="lg"
        block
        :disabled="isLoading"
        :loading="isGithubLoading"
        class="justify-center"
        @click="handleGithubLink"
      >
        <template #leading>
          <Icon
            name="logos:github-icon"
            class="w-5 h-5"
          />
        </template>
        Link GitHub Account Instead
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useSupabaseClient } from '../composables/useSupabaseComposables'
import { useTeamAuthConfig } from '../composables/useTeamAuthConfig'
import { usePasswordPolicy } from '../composables/usePasswordPolicy'
import { useRuntimeConfig } from '#imports'

interface PasswordSetupFormProps {
  /** User's email address */
  email?: string
  /** Team name they're joining */
  teamName?: string
  /** Show social login options */
  showSocialLogin?: boolean
  /** Enable Google authentication */
  googleAuth?: boolean
  /** Enable GitHub authentication */
  githubAuth?: boolean
  /** Session data for authentication */
  sessionData?: {
    access_token: string
    refresh_token: string
  }
}

interface PasswordSetupForm {
  password: string
  confirmPassword: string
  fullName: string
}

const props = withDefaults(defineProps<PasswordSetupFormProps>(), {
  email: '',
  teamName: '',
  showSocialLogin: true,
  googleAuth: true,
  githubAuth: false,
})

const emit = defineEmits<{
  'success': []
  'error': [error: string]
  'social-link': [provider: string]
}>()

// Get Supabase client and config
const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()

// Form state
const form = reactive<PasswordSetupForm>({
  password: '',
  confirmPassword: '',
  fullName: '',
})

// Composables
const { isGoogleEnabled, isGithubEnabled, hasAnySocialProvider } = useTeamAuthConfig()
const { getPasswordSchema, createConfirmPasswordValidator, passwordHelpText } = usePasswordPolicy()

// Dynamic validation schema using password policy
const passwordSchema = computed(() => v.object({
  password: getPasswordSchema(),
  confirmPassword: createConfirmPasswordValidator(() => form.password),
  fullName: v.optional(v.string()),
}))

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
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

// Handle password setup
const handlePasswordSetup = async (event: FormSubmitEvent<any>) => {
  try {
    isLoading.value = true
    message.value = ''

    // Try multiple sources for tokens
    let accessToken = props.sessionData?.access_token

    if (!accessToken) {
      const { data: { session } } = await supabase.auth.getSession()
      accessToken = session?.access_token
    }

    if (!accessToken) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      accessToken = hashParams.get('access_token') || undefined
    }

    if (!accessToken) {
      throw new Error('No valid session found for password update')
    }

    // Update user's password using direct API approach
    try {
      const supabaseUrl = runtimeConfig.public.supabase?.url
      const supabaseKey = runtimeConfig.public.supabase?.key
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration not available')
      }
      await $fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: {
          password: event.data.password,
        },
      })
    }
    catch (apiError: unknown) {
      const err = apiError as Error
      throw new Error(`Failed to set password: ${err.message || 'Unknown error'}`)
    }

    // Update profile if full name was provided
    if (event.data.fullName) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: event.data.fullName,
            updated_at: new Date().toISOString(),
          })

        if (profileError) {
          console.error('Profile update error:', profileError)
          // Don't throw here, password was set successfully
        }
      }
    }

    // Success!
    message.value = 'Password set successfully!'
    messageType.value = 'success'

    // Emit success after a short delay
    setTimeout(() => {
      emit('success')
    }, 1000)
  }
  catch (error: any) {
    console.error('Password setup error:', error)
    message.value = error.message || 'Failed to set password'
    messageType.value = 'error'
    emit('error', error.message || 'Failed to set password')
  }
  finally {
    isLoading.value = false
  }
}

// Handle Google account linking
const handleGoogleLink = async () => {
  try {
    isGoogleLoading.value = true

    // Get current session to preserve team metadata
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No valid session found')
    }

    // For invited users, use linkIdentity instead of signInWithOAuth
    // This links Google to the existing invited user account
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?mode=invite-link&team_id=${session.user.user_metadata?.team_id}`,
      },
    })

    if (error) {
      throw error
    }

    // If successful, the user will be redirected to Google OAuth
    // After OAuth completes, they'll come back and we can proceed
    emit('social-link', 'google')
  }
  catch (error: any) {
    console.error('Google link error:', error)
    message.value = error.message || 'Failed to link Google account'
    messageType.value = 'error'
  }
  finally {
    isGoogleLoading.value = false
  }
}

// Handle GitHub account linking
const handleGithubLink = async () => {
  try {
    isGithubLoading.value = true

    // Get current session to preserve team metadata
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No valid session found')
    }

    // For invited users, use linkIdentity instead of signInWithOAuth
    // This links GitHub to the existing invited user account
    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?mode=invite-link&team_id=${session.user.user_metadata?.team_id}`,
      },
    })

    if (error) {
      throw error
    }

    // If successful, the user will be redirected to GitHub OAuth
    // After OAuth completes, they'll come back and we can proceed
    emit('social-link', 'github')
  }
  catch (error: any) {
    console.error('GitHub link error:', error)
    message.value = error.message || 'Failed to link GitHub account'
    messageType.value = 'error'
  }
  finally {
    isGithubLoading.value = false
  }
}
</script>

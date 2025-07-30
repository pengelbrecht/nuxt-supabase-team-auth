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

    <!-- Password Reset Form -->
    <UForm
      :schema="passwordSchema"
      :state="form"
      class="space-y-4"
      @submit="handlePasswordReset"
    >
      <!-- New Password Field -->
      <UFormField
        label="New Password"
        name="password"
        required
        :description="passwordHelpText"
      >
        <UInput
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your new password"
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

      <!-- Confirm Password Field -->
      <UFormField
        label="Confirm New Password"
        name="confirmPassword"
        required
      >
        <UInput
          v-model="form.confirmPassword"
          :type="showConfirmPassword ? 'text' : 'password'"
          placeholder="Confirm your new password"
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

      <!-- Submit Button -->
      <UButton
        type="submit"
        :loading="isLoading"
        color="primary"
        size="lg"
        block
        class="mt-6"
      >
        Reset Password
      </UButton>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { $fetch } from 'ofetch'
import { useSupabaseClient } from '../composables/useSupabaseComposables'
import { usePasswordPolicy } from '../composables/usePasswordPolicy'

interface ResetPasswordForm {
  password: string
  confirmPassword: string
}

const emit = defineEmits<{
  success: []
  error: [error: string]
}>()

// Get Supabase client
const supabase = useSupabaseClient()

// Form state
const form = reactive<ResetPasswordForm>({
  password: '',
  confirmPassword: '',
})

// Get password policy composable
const { getPasswordSchema, createConfirmPasswordValidator, passwordHelpText } = usePasswordPolicy()

// Dynamic validation schema using password policy
const passwordSchema = computed(() => v.object({
  password: getPasswordSchema(),
  confirmPassword: createConfirmPasswordValidator(() => form.password),
}))

// UI state
const isLoading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

// Handle password reset
const handlePasswordReset = async (event: FormSubmitEvent<any>) => {
  try {
    isLoading.value = true
    message.value = ''

    // Get current session
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (!currentSession) {
      throw new Error('No valid session found for password update')
    }

    // Update user's password using direct API approach (same as PasswordSetupForm)
    try {
      await $fetch(`${supabase.supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabase.supabaseKey,
        },
        body: {
          password: event.data.password,
        },
      })
    }
    catch (apiError) {
      throw new Error(`Failed to reset password: ${apiError.message || 'Unknown error'}`)
    }

    // Success!
    message.value = 'Password reset successfully!'
    messageType.value = 'success'

    // Emit success after a short delay
    setTimeout(() => {
      emit('success')
    }, 1000)
  }
  catch (error: any) {
    console.error('Password reset error:', error)
    message.value = error.message || 'Failed to reset password'
    messageType.value = 'error'
    emit('error', error.message || 'Failed to reset password')
  }
  finally {
    isLoading.value = false
  }
}
</script>

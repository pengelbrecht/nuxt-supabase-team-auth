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
        description="Must be at least 8 characters long"
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
import { ref, reactive } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useSupabaseClient } from '../composables/useSupabaseComposables'

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

// Validation schema using Valibot
const passwordSchema = v.object({
  password: v.pipe(
    v.string(),
    v.minLength(8, 'Password must be at least 8 characters'),
    v.regex(/[A-Z]/, 'Password must contain at least one uppercase letter'),
    v.regex(/[a-z]/, 'Password must contain at least one lowercase letter'),
    v.regex(/\d/, 'Password must contain at least one number'),
  ),
  confirmPassword: v.pipe(
    v.string(),
    v.custom(value => value === form.password, 'Passwords do not match'),
  ),
})

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

    // Update user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: event.data.password,
    })

    if (updateError) {
      throw new Error(updateError.message)
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

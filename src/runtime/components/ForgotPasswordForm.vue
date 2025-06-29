<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <div class="text-center">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Reset Your Password
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Enter your email address and we'll send you a reset link
        </p>
      </div>
    </template>

    <!-- Alert for messages -->
    <UAlert
      v-if="message"
      :color="messageType"
      :title="messageType === 'error' ? 'Error' : 'Success'"
      :description="message"
      :icon="messageType === 'error' ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-check-circle'"
      class="mb-4"
    />

    <!-- Forgot Password Form -->
    <UForm
      v-if="!isSuccess"
      :schema="emailSchema"
      :state="form"
      class="space-y-4"
      @submit="handleForgotPassword"
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
          placeholder="Enter your email address"
          autocomplete="email"
          :disabled="isLoading"
          icon="i-heroicons-envelope"
          size="lg"
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
        Send Reset Link
      </UButton>
    </UForm>

    <!-- Success State -->
    <div
      v-else
      class="text-center space-y-4"
    >
      <UIcon
        name="i-heroicons-envelope"
        class="w-12 h-12 mx-auto text-green-500"
      />
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Check Your Email
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          We've sent a password reset link to <strong>{{ form.email }}</strong>
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Didn't receive the email? Check your spam folder or try again.
        </p>
      </div>
    </div>

    <template #footer>
      <div class="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
        Remember your password?
        <UButton
          type="button"
          variant="ghost"
          size="sm"
          class="font-medium text-primary-600 hover:text-primary-500"
          @click="$emit('back-to-signin')"
        >
          Back to Sign In
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useSupabaseClient } from '#imports'

interface ForgotPasswordForm {
  email: string
}

const emit = defineEmits<{
  'success': [email: string]
  'error': [error: string]
  'back-to-signin': []
}>()

// Get Supabase client
const supabase = useSupabaseClient()

// Form state
const form = reactive<ForgotPasswordForm>({
  email: '',
})

// Validation schema using Valibot
const emailSchema = v.object({
  email: v.pipe(v.string(), v.email('Please enter a valid email address')),
})

// UI state
const isLoading = ref(false)
const isSuccess = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

// Handle forgot password
const handleForgotPassword = async (event: FormSubmitEvent<any>) => {
  try {
    isLoading.value = true
    message.value = ''

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(
      event.data.email,
      {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    )

    if (error) {
      throw new Error(error.message)
    }

    // Success!
    isSuccess.value = true
    emit('success', event.data.email)
  }
  catch (error: any) {
    console.error('Forgot password error:', error)
    message.value = error.message || 'Failed to send reset email'
    messageType.value = 'error'
    emit('error', error.message || 'Failed to send reset email')
  }
  finally {
    isLoading.value = false
  }
}
</script>

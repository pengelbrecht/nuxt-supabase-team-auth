<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <ForgotPasswordForm
      @success="handleSuccess"
      @error="handleError"
      @back-to-signin="goToSignin"
    />
  </div>
</template>

<script setup lang="ts">
import ForgotPasswordForm from '../../components/ForgotPasswordForm.vue'
import { useRouter } from '#imports'

const router = useRouter()

// Handle successful password reset request
const handleSuccess = (email: string) => {
  console.log('Password reset email sent to:', email)
}

// Handle errors
const handleError = (error: string) => {
  console.error('Forgot password error:', error)
}

// Navigate back to sign in
const goToSignin = () => {
  router.push('/signin')
}

// Set page meta
definePageMeta({
  layout: false, // Use no layout for this page
  auth: false, // Don't require auth for forgot password
})

// Define component name for ESLint
defineOptions({
  name: 'ForgotPassword',
})
</script>

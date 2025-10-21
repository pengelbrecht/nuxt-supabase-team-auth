<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Sign in to your account
        </h2>
      </div>
      <ClientOnly>
        <AuthSignIn
          @error="handleError"
          @forgot-password="handleForgotPassword"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'redirect-authenticated',
})

const router = useRouter()
const toast = useToast()

// AuthSignIn component now handles redirects internally
// No need to implement redirect logic here

const handleError = (error) => {
  toast.add({
    title: 'Sign In Failed',
    description: error,
    color: 'red',
  })
}

const handleForgotPassword = () => {
  router.push('/auth/forgot-password')
}
</script>

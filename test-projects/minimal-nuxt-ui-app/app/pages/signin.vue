<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Sign in to your account
        </h2>
      </div>
      <AuthSignIn @success="handleSignIn" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'redirect-authenticated'
})

const router = useRouter()

const handleSignIn = () => {
  router.push('/dashboard')
}
</script>
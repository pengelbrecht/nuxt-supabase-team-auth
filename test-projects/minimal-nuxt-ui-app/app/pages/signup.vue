<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Create your account
        </h2>
      </div>
      <ClientOnly>
        <AuthSignUpWithTeam @success="handleSignUp" />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'redirect-authenticated',
})

const router = useRouter()

const handleSignUp = () => {
  router.push('/dashboard')
}
</script>

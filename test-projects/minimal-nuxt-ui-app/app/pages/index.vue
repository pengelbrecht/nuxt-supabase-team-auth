<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Team Auth Demo
        </h1>
        <SignedIn>
          <UserButton :show-name="true" />
        </SignedIn>
      </div>

      <!-- Auth State Display -->
      <SignedOut>
        <UCard class="max-w-2xl mx-auto">
          <template #header>
            <h2 class="text-xl font-semibold">
              Welcome! Please sign in
            </h2>
          </template>

          <div class="space-y-6">
            <AuthSignIn @signed-in="handleSignedIn" />

            <div class="flex items-center gap-4 my-6">
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span class="text-sm text-gray-500 dark:text-gray-400">or</span>
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <AuthSignUpWithTeam @signed-up="handleSignedUp" />
          </div>
        </UCard>
      </SignedOut>

      <SignedIn>
        <div class="space-y-6">
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold">
                You're signed in!
              </h2>
            </template>

            <div class="space-y-4">
              <p>Welcome to the team auth demo. You can now access protected pages.</p>

              <UButton
                to="/dashboard"
                color="primary"
                size="lg"
              >
                Go to Dashboard
              </UButton>
            </div>
          </UCard>
        </div>
      </SignedIn>
    </div>
  </div>
</template>

<script setup>
const handleSignedIn = () => {
  console.log('User signed in successfully')
}

const handleSignedUp = () => {
  console.log('User signed up successfully')
}
</script>

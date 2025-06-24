<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <!-- Header with UserButton -->
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <UserButton :show-name="true" />
      </div>

      <!-- Protected Content -->
      <SignedIn>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- User Info Card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <UIcon name="i-lucide-user" />
                User Information
              </h2>
            </template>

            <div class="space-y-2">
              <p><strong>Name:</strong> {{ currentUser?.user_metadata?.name || 'Not set' }}</p>
              <p><strong>Email:</strong> {{ currentUser?.email }}</p>
              <p><strong>ID:</strong> {{ currentUser?.id }}</p>
            </div>
          </UCard>

          <!-- Team Info Card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <UIcon name="i-lucide-users" />
                Team Information
              </h2>
            </template>

            <div class="space-y-2">
              <p><strong>Team:</strong> {{ currentTeam?.name || 'No team' }}</p>
              <p><strong>Role:</strong> {{ currentRole || 'No role' }}</p>
              <p><strong>Team ID:</strong> {{ currentTeam?.id || 'N/A' }}</p>
            </div>
          </UCard>

          <!-- Actions Card -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold flex items-center gap-2">
                <UIcon name="i-lucide-settings" />
                Quick Actions
              </h2>
            </template>

            <div class="space-y-3">
              <UButton
                color="gray"
                variant="outline"
                class="w-full"
                @click="refreshProfile"
              >
                Refresh Profile
              </UButton>

              <UButton
                color="red"
                variant="outline"
                class="w-full"
                @click="handleSignOut"
              >
                Sign Out
              </UButton>
            </div>
          </UCard>
        </div>

        <!-- Raw Auth State (for debugging) -->
        <UCard
          v-if="$route.query.debug"
          class="mt-8"
        >
          <template #header>
            <h2 class="text-lg font-semibold">
              Debug: Auth State
            </h2>
          </template>

          <pre class="text-xs overflow-auto">{{ {
            currentUser: currentUser,
            currentTeam: currentTeam,
            currentRole: currentRole,
            currentProfile: currentProfile,
          } }}</pre>
        </UCard>
      </SignedIn>

      <!-- Fallback for signed out users -->
      <SignedOut>
        <UCard class="max-w-md mx-auto">
          <template #header>
            <h2 class="text-xl font-semibold">
              Access Denied
            </h2>
          </template>

          <div class="space-y-4">
            <p>You must be signed in to access the dashboard.</p>

            <UButton
              to="/"
              color="primary"
              class="w-full"
            >
              Go to Home
            </UButton>
          </div>
        </UCard>
      </SignedOut>
    </div>
  </div>
</template>

<script setup>
// This page should be protected by middleware
definePageMeta({
  middleware: 'require-auth',
})

// Get auth state from our composable
const {
  currentUser,
  currentTeam,
  currentRole,
  currentProfile,
  signOut,
  refreshProfile,
} = useTeamAuth()

const handleSignOut = async () => {
  await signOut()
  await navigateTo('/')
}
</script>

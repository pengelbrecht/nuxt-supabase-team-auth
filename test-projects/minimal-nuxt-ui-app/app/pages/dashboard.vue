<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8">
          <SignedIn>
            <div class="text-center">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Welcome to Dashboard
              </h1>
              <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
                You are successfully signed in!
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <UCard>
                  <template #header>
                    <h3 class="text-lg font-semibold">
                      User Info
                    </h3>
                  </template>
                  <div class="space-y-2">
                    <p><strong>Email:</strong> {{ currentUser?.email }}</p>
                    <p><strong>Role:</strong> <RoleBadge :role="currentRole" /></p>
                    <p><strong>Team:</strong> {{ currentTeam?.name }}</p>
                  </div>
                </UCard>

                <UCard>
                  <template #header>
                    <h3 class="text-lg font-semibold">
                      Team Members
                    </h3>
                  </template>
                  <div class="space-y-2">
                    <p>Total members: {{ teamMembers?.length || 0 }}</p>
                    <div
                      v-for="member in teamMembers"
                      :key="member.user_id"
                      class="text-sm"
                    >
                      {{ member.user?.email }} - {{ member.role }}
                    </div>
                  </div>
                </UCard>

                <UCard>
                  <template #header>
                    <h3 class="text-lg font-semibold">
                      Quick Actions
                    </h3>
                  </template>
                  <div class="space-y-2">
                    <UButton
                      block
                      variant="outline"
                      @click="handleManageTeamClick"
                    >
                      Manage Team
                    </UButton>
                  </div>
                </UCard>
              </div>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>

    <TeamMembersDialog v-model="showTeamDialog" />
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'require-auth',
})

const { currentUser, currentTeam, currentRole, teamMembers } = useTeamAuth()
const showTeamDialog = ref(false)

const handleManageTeamClick = () => {
  console.log('Dashboard: Manage Team clicked')
  showTeamDialog.value = true
  console.log('Dashboard: showTeamDialog set to:', showTeamDialog.value)
}
</script>

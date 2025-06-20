<template>
  <!-- Impersonation Banner - Only shows when impersonating -->
  <div
    v-if="isImpersonating"
    class="!bg-red-600 dark:!bg-red-700 !text-white !border-b !border-red-700 dark:!border-red-800 shadow-lg"
    style="background-color: #dc2626 !important; color: white !important; border-color: #b91c1c !important;"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-3">
        <div class="flex items-center justify-between">
          <!-- Left side - Impersonation info -->
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-user-check"
              class="h-5 w-5 !text-red-100"
              style="color: #fecaca !important;"
            />
            <div>
              <div class="font-semibold text-sm">
                Impersonating {{ displayUser?.full_name || displayUser?.email || 'User' }}
              </div>
              <div class="text-xs !text-red-100" style="color: #fecaca !important;">
                <span v-if="displayUser?.team?.name">
                  {{ displayUser.team.name }} •
                </span>
                <RoleBadge
                  :role="displayUser?.role"
                  size="xs"
                  class="inline-block"
                />
                <span
                  v-if="timeRemaining"
                  class="ml-2"
                >
                  • {{ timeRemaining }} remaining
                </span>
              </div>
            </div>
          </div>

          <!-- Right side - Stop button -->
          <UButton
            variant="outline"
            size="sm"
            color="white"
            :loading="isStopping"
            class="!text-white !border-white hover:!bg-white hover:!text-red-600"
            style="color: white !important; border-color: white !important;"
            @click="handleStopImpersonation"
          >
            <template #leading>
              <UIcon
                name="i-lucide-user-x"
                class="h-4 w-4"
              />
            </template>
            Stop Impersonation
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import RoleBadge from './RoleBadge.vue'

// Get unified auth state including impersonation
const {
  isImpersonating,
  impersonatedUser,
  impersonationExpiresAt,
  stopImpersonation,
  isLoading,
  currentUser,
  currentProfile,
  currentTeam,
  currentRole,
} = useTeamAuth()

// For display, use impersonated user data if available, otherwise current user data
const displayUser = computed(() => {
  if (!isImpersonating.value) return null
  
  // If we have stored impersonated user data, use it
  if (impersonatedUser.value) {
    return impersonatedUser.value
  }
  
  // Otherwise fallback to current user/profile data
  const user = currentUser.value
  const profile = currentProfile.value
  const team = currentTeam.value
  const role = currentRole.value
  
  if (user) {
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.name,
      role: role,
      team: team
    }
  }
  
  return null
})
const isStopping = computed(() => isLoading.value)

// Current time for countdown
const currentTime = ref(new Date())

// Update current time every second for countdown
let timeInterval: NodeJS.Timeout | null = null

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})

// Toast notifications (available but not used directly here)
const _toast = useToast()

// Computed properties
const timeRemaining = computed(() => {
  if (!impersonationExpiresAt.value) return null

  const now = currentTime.value.getTime()
  const expiresAt = new Date(impersonationExpiresAt.value).getTime()
  const diff = expiresAt - now

  if (diff <= 0) return 'EXPIRED'

  const minutes = Math.floor(diff / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  else {
    return `${seconds}s`
  }
})

// Actions
const handleStopImpersonation = async () => {
  try {
    await stopImpersonation()
  }
  catch (error: unknown) {
    console.error('Failed to stop impersonation:', error)
    // Error handling is already done in useImpersonation
  }
}
</script>

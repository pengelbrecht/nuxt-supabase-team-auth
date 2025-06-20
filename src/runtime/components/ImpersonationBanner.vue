<template>
  <!-- Impersonation Banner - Only shows when impersonating -->
  <div
    v-if="isImpersonating"
    class="bg-orange-500 dark:bg-orange-600 text-white border-b border-orange-600 dark:border-orange-700"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-3">
        <div class="flex items-center justify-between">
          <!-- Left side - Impersonation info -->
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-user-check"
              class="h-5 w-5 text-orange-100"
            />
            <div>
              <div class="font-semibold text-sm">
                Impersonating {{ impersonatedUser?.full_name || impersonatedUser?.email || 'User' }}
              </div>
              <div class="text-xs text-orange-100">
                <span v-if="impersonatedUser?.team?.name">
                  {{ impersonatedUser.team.name }} •
                </span>
                <RoleBadge
                  :role="impersonatedUser?.role"
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
            class="text-white border-white hover:bg-white hover:text-orange-600"
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
import { useImpersonation } from '../composables/useImpersonation'
import RoleBadge from './RoleBadge.vue'

// Get impersonation state
const {
  isImpersonating,
  impersonatedUser,
  impersonationExpiresAt,
  stopImpersonation,
  isStopping,
} = useImpersonation()

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

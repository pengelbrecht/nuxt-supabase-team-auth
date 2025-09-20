<template>
  <!-- Impersonation Banner - Only shows when impersonating -->
  <div
    v-if="isImpersonating"
    ref="bannerRef"
    class="fixed inset-x-0 top-0 z-50 !bg-red-600 dark:!bg-red-700 !text-white !border-b !border-red-700 dark:!border-red-800 shadow-lg"
    style="background-color: #dc2626 !important; color: white !important; border-color: #b91c1c !important;"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-4">
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
                You are impersonating {{ displayUser?.full_name || displayUser?.email || 'User' }}
              </div>
              <div class="flex items-baseline gap-2 text-xs text-red-100 pb-2">
                <span v-if="displayUser?.team?.name">
                  {{ displayUser.team.name }}
                </span>
                <span v-if="displayUser?.team?.name">•</span>
                <div class="inline-block mb-1">
                  <RoleBadge
                    :role="displayUser?.role"
                    size="xs"
                    variant="solid"
                  />
                </div>
                <span v-if="timeRemaining">
                  • {{ timeRemaining }} remaining
                </span>
              </div>
            </div>
          </div>

          <!-- Right side - Stop button -->
          <UButton
            variant="solid"
            size="sm"
            color="neutral"
            :loading="isStopping"
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
      team: team,
    }
  }

  return null
})
const isStopping = computed(() => isLoading.value)

// Current time for countdown
const currentTime = ref(new Date())

// Banner element ref for height calculation
const bannerRef = ref<HTMLElement>()

// Update current time every second for countdown
let timeInterval: NodeJS.Timeout | null = null

// Function to apply banner height to CSS custom property and body class
const applyBannerStyles = () => {
  if (!process.client || !bannerRef.value) return

  const height = bannerRef.value.offsetHeight
  document.documentElement.style.setProperty('--impersonation-banner-height', `${height}px`)
  document.body.classList.add('has-impersonation-banner')
}

// Function to remove banner styles
const removeBannerStyles = () => {
  if (!process.client) return

  document.documentElement.style.removeProperty('--impersonation-banner-height')
  document.body.classList.remove('has-impersonation-banner')
}

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)

  // Apply banner styles if impersonating on mount
  if (isImpersonating.value) {
    nextTick(() => {
      applyBannerStyles()
    })
  }
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }

  // Clean up banner styles
  removeBannerStyles()
})

// Watch for changes in impersonation state
watch(isImpersonating, (newValue) => {
  if (!process.client) return

  if (newValue) {
    nextTick(() => {
      applyBannerStyles()
    })
  } else {
    removeBannerStyles()
  }
}, { immediate: false })

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

<style>
/* Global styles for when impersonation banner is active */
body.has-impersonation-banner {
  padding-top: var(--impersonation-banner-height, 64px);
}

/* Adjust fixed elements to respect the banner */
body.has-impersonation-banner .fixed {
  top: var(--impersonation-banner-height, 64px) !important;
}

/* Specific adjustments for common dashboard layouts */
body.has-impersonation-banner aside.fixed,
body.has-impersonation-banner aside#default {
  top: var(--impersonation-banner-height, 64px) !important;
  height: calc(100vh - var(--impersonation-banner-height, 64px)) !important;
}

body.has-impersonation-banner main.fixed {
  top: var(--impersonation-banner-height, 64px) !important;
  height: calc(100vh - var(--impersonation-banner-height, 64px)) !important;
}

/* Ensure the banner itself is not affected by its own styles */
.has-impersonation-banner .fixed.inset-x-0.top-0 {
  top: 0 !important;
}
</style>

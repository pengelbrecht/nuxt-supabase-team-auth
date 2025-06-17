<template>
  <div class="flex items-center" :class="containerClass">
    <UAvatar
      :alt="displayName || email || 'User'"
      :size="avatarSize"
      class="ring-2 ring-gray-200 dark:ring-gray-700"
    >
      {{ avatarFallback }}
    </UAvatar>
    
    <!-- Spacer -->
    <div style="width: 1rem; flex-shrink: 0;"></div>
    
    <div class="flex flex-col justify-center flex-1">
      <p v-if="displayName" class="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {{ displayName }}
      </p>
      <p class="text-xs text-gray-600 dark:text-gray-400" :class="{ 'font-semibold text-gray-900 dark:text-gray-100': !displayName }">
        {{ email }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

// Props
interface Props {
  /** Display name override */
  name?: string | null
  /** Email override */
  email?: string | null
  /** Avatar size */
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Additional CSS classes for container */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  avatarSize: 'xl',
  class: ''
})

// Get auth state and avatar utility
const { currentUser, getAvatarFallback } = useTeamAuth()

// Computed properties
const displayName = computed(() => {
  return props.name || currentUser.value?.user_metadata?.name || null
})

const email = computed(() => {
  return props.email || currentUser.value?.email || ''
})

const avatarFallback = computed(() => {
  return getAvatarFallback({
    fullName: displayName.value,
    email: email.value
  })
})

const containerClass = computed(() => props.class)
</script>
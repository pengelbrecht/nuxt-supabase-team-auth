<template>
  <div v-if="isAuthenticated">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

const { currentUser, isLoading } = useTeamAuth()

const isAuthenticated = computed(() => {
  // Once a user is authenticated, keep them authenticated during loading states
  // Only check loading on initial auth check when currentUser is null
  if (currentUser.value) {
    return true
  }
  return !isLoading.value && !!currentUser.value
})
</script>

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
  return !isLoading.value && !!currentUser.value
})
</script>

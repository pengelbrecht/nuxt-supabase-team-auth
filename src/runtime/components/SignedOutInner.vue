<template>
  <div v-if="isUnauthenticated">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

const { currentUser, isLoading } = useTeamAuth()

const isUnauthenticated = computed(() => {
  return !isLoading.value && !currentUser.value
})
</script>

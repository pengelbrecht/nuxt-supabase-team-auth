<template>
  <div v-if="isSignedOut">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

// Get auth state
const { currentUser, isLoading } = useTeamAuth()

// Show content when signed out and not loading
const isSignedOut = computed(() => !isLoading.value && !currentUser.value)
</script>

<script lang="ts">
export default {
  name: 'SignedOut',
}
</script>
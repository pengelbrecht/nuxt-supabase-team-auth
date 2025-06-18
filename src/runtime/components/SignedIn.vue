<template>
  <div v-if="isSignedIn">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

// Get auth state
const { currentUser, isLoading } = useTeamAuth()

// Show content when signed in and not loading
const isSignedIn = computed(() => !isLoading.value && !!currentUser.value)
</script>

<script lang="ts">
export default {
  name: 'SignedIn',
}
</script>
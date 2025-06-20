<template>
  <div v-if="showContent">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const showContent = ref(false)

onMounted(async () => {
  // Simple check - just try to access the composable
  try {
    const { currentUser } = await import('../composables/useTeamAuth').then(m => m.useTeamAuth())
    showContent.value = !!currentUser.value
  }
  catch (e) {
    console.error('SignedIn error:', e)
    showContent.value = false
  }
})
</script>

<template>
  <div class="settings-tab-container">
    <slot />
  </div>
</template>

<script setup lang="ts">
// A dedicated container component for settings tabs
// Provides consistent sizing and scrolling behavior
</script>

<style scoped>
.settings-tab-container {
  width: 100%;
  height: 70vh;
  min-height: 600px;
  max-height: 800px;
  overflow-y: auto;
  padding: 1.5rem;
}

/* Ensure responsive behavior */
@media (max-height: 768px) {
  .settings-tab-container {
    height: 80vh;
    min-height: 500px;
  }
}

@media (max-height: 640px) {
  .settings-tab-container {
    height: 85vh;
    min-height: 400px;
  }
}
</style>
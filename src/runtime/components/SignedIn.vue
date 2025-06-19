<template>
  <ClientOnly>
    <SignedInInner>
      <slot />
    </SignedInInner>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import SignedInInner from './SignedInInner.vue'

defineSlots<{
  default(): any
  fallback?(): any
}>()
</script>

<script lang="ts">
export default {
  name: 'SignedIn',
}
</script>
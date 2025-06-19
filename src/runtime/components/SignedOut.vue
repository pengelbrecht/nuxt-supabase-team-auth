<template>
  <ClientOnly>
    <SignedOutInner>
      <slot />
    </SignedOutInner>
    <template #fallback>
      <slot name="fallback" />
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import SignedOutInner from './SignedOutInner.vue'

defineSlots<{
  default(): any
  fallback?(): any
}>()
</script>

<script lang="ts">
export default {
  name: 'SignedOut',
}
</script>
<template>
  <DialogBox
    v-model="isOpen"
    :title="title"
    :subtitle="subtitle"
    :loading="loading"
    :show-save-button="false"
    :prevent-close="loading"
    :body-class="bodyClass"
    :ui="ui"
    @close="handleClose"
  >
    <template
      v-if="$slots.actions"
      #actions
    >
      <slot name="actions" />
    </template>

    <slot />

    <!-- Action buttons at bottom -->
    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
      <UButton
        variant="ghost"
        :disabled="loading"
        @click="handleClose"
      >
        {{ cancelText }}
      </UButton>
      <UButton
        :color="actionColor"
        :disabled="!isValid || loading"
        :loading="loading"
        @click="handleAction"
      >
        {{ actionText }}
      </UButton>
    </div>
  </DialogBox>
</template>

<script setup lang="ts">
// No imports needed for this component

interface Props {
  title: string
  subtitle?: string
  actionText?: string
  cancelText?: string
  actionColor?: string
  loading?: boolean
  isValid?: boolean
  bodyClass?: string
  ui?: any
}

const props = withDefaults(defineProps<Props>(), {
  actionText: 'Submit',
  cancelText: 'Cancel',
  actionColor: 'primary',
  loading: false,
  isValid: true,
})

const emit = defineEmits<{
  action: []
  close: []
}>()

const isOpen = defineModel<boolean>({ required: true })

const handleAction = () => {
  emit('action')
}

const handleClose = () => {
  if (!props.loading) {
    isOpen.value = false
    emit('close')
  }
}
</script>

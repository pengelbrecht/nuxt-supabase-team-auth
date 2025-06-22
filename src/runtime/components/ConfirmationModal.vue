<template>
  <ConfirmDialog
    v-model="isOpen"
    :title="title"
    :message="message"
    :cancel-text="cancelText"
    :confirm-text="confirmText"
    :confirm-color="confirmColor"
    :loading="isLoading"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  /** Modal title */
  title?: string
  /** Confirmation message */
  message?: string
  /** Cancel button text */
  cancelText?: string
  /** Confirm button text */
  confirmText?: string
  /** Confirm button color */
  confirmColor?: 'red' | 'green' | 'blue' | 'yellow' | 'gray'
  /** Loading state */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  cancelText: 'Cancel',
  confirmText: 'Confirm',
  confirmColor: 'red',
  loading: false,
})

// Emits
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

// State
const isOpen = defineModel<boolean>('open', { default: false })
const isLoading = computed(() => props.loading)

// Methods
const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

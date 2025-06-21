<template>
  <UModal
    v-model:open="isOpen"
    :title="title"
  >
    <template #body>
      <div class="p-6 space-y-4">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ message }}
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <UButton
            variant="ghost"
            :disabled="isLoading"
            @click="handleCancel"
          >
            {{ cancelText }}
          </UButton>
          <UButton
            :color="confirmColor"
            :loading="isLoading"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
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
  isOpen.value = false
  emit('cancel')
}
</script>

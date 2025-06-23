<template>
  <DialogBox
    v-model="isOpen"
    :title="title"
    :loading="loading"
    :show-save-button="false"
    :prevent-close="loading"
    body-class="p-6"
    :ui="ui"
    @close="handleCancel"
  >
    <div class="space-y-6">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {{ message }}
      </div>
      
      <div class="flex justify-end gap-3">
        <UButton
          variant="ghost"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </UButton>
        <UButton
          :color="confirmColor"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </UButton>
      </div>
    </div>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  /** Whether the dialog is open */
  modelValue: boolean
  /** Dialog title */
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
  /** Custom UI config */
  ui?: Record<string, unknown>
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  cancelText: 'Cancel',
  confirmText: 'Confirm',
  confirmColor: 'red',
  loading: false,
  ui: () => ({}),
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

// Methods
const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  isOpen.value = false
  emit('cancel')
}
</script>

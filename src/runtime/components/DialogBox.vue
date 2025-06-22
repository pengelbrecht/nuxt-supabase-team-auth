<template>
  <UModal
    v-model:open="isOpen"
    :title="title"
    :description="subtitle"
    :ui="ui"
  >
    <template #header>
      <div class="flex justify-between items-center w-full">
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ title }}
          </h2>
          <p
            v-if="subtitle"
            class="text-sm text-gray-600 dark:text-gray-400 mt-1"
          >
            {{ subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-3 ml-4">
          <!-- Status indicators -->
          <span
            v-if="hasChanges && showChangeIndicator"
            class="text-sm text-amber-600 dark:text-amber-400 font-medium"
          >
            You have unsaved changes
          </span>
          
          <!-- Custom actions slot -->
          <slot name="actions">
            <!-- Default save button for forms -->
            <UButton
              v-if="showSaveButton"
              color="primary"
              variant="solid"
              size="md"
              :loading="loading"
              :disabled="loading || (requireChanges && !hasChanges)"
              class="min-w-[120px]"
              @click="$emit('save')"
            >
              {{ saveText }}
            </UButton>
          </slot>
          
          <!-- Close button -->
          <UButton
            color="gray"
            variant="ghost"
            size="md"
            icon="i-heroicons-x-mark-20-solid"
            :disabled="loading || preventClose"
            @click="handleClose"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div :class="bodyClass">
        <slot />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  /** Whether the dialog is open */
  modelValue: boolean
  /** Dialog title */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Loading state (disables close, shows loading on save) */
  loading?: boolean
  /** Whether form has unsaved changes */
  hasChanges?: boolean
  /** Show the save button (for form dialogs) */
  showSaveButton?: boolean
  /** Text for save button */
  saveText?: string
  /** Show change indicator */
  showChangeIndicator?: boolean
  /** Require changes before enabling save */
  requireChanges?: boolean
  /** Prevent closing the dialog */
  preventClose?: boolean
  /** Custom body padding class */
  bodyClass?: string
  /** Custom UI config to pass to UModal */
  ui?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasChanges: false,
  showSaveButton: false,
  saveText: 'Save Changes',
  showChangeIndicator: true,
  requireChanges: true,
  preventClose: false,
  bodyClass: 'p-6',
  ui: () => ({}),
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': []
  'close': []
}>()

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})


// Methods
const handleClose = () => {
  if (!props.loading && !props.preventClose) {
    emit('close')
    isOpen.value = false
  }
}

// Expose close method for parent components
defineExpose({
  close: handleClose,
})
</script>
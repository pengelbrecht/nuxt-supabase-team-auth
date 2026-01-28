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
          <!-- Fixed height unsaved changes indicator -->
          <div class="h-5 mt-1 flex items-center">
            <span
              v-if="hasChanges && showChangeIndicator"
              class="text-sm text-amber-600 dark:text-amber-400 font-medium"
            >
              You have unsaved changes
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3 ml-4">
          <!-- Custom actions slot (for non-form dialogs) -->
          <slot name="actions" />

          <!-- Close button -->
          <UButton
            color="neutral"
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

      <!-- Bottom action buttons for forms -->
      <div
        v-if="showSaveButton"
        class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <UButton
          variant="ghost"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </UButton>
        <UButton
          color="primary"
          :disabled="loading || (requireChanges && !hasChanges)"
          :loading="loading"
          class="min-w-[120px]"
          @click="$emit('save')"
        >
          {{ saveText }}
        </UButton>
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
  /** Text for cancel button */
  cancelText?: string
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
  cancelText: 'Cancel',
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
  'cancel': []
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

const handleCancel = () => {
  if (!props.loading) {
    emit('cancel')
    isOpen.value = false
  }
}

// Expose close method for parent components
defineExpose({
  close: handleClose,
})
</script>

<style>
/* Force modal width with high specificity - targeting the actual DialogContent */
[data-state="open"][role="dialog"] {
  width: 95vw !important;
  max-width: 95vw !important;
}

@media (min-width: 640px) {
  [data-state="open"][role="dialog"] {
    width: 85vw !important;
    max-width: 85vw !important;
  }
}

@media (min-width: 768px) {
  [data-state="open"][role="dialog"] {
    width: 75vw !important;
    max-width: 75vw !important;
  }
}

@media (min-width: 1024px) {
  [data-state="open"][role="dialog"] {
    width: 65vw !important;
    max-width: 65vw !important;
  }
}

@media (min-width: 1280px) {
  [data-state="open"][role="dialog"] {
    width: 55vw !important;
    max-width: 55vw !important;
  }
}

@media (min-width: 1536px) {
  [data-state="open"][role="dialog"] {
    width: 50vw !important;
    max-width: 1152px !important;
  }
}
</style>

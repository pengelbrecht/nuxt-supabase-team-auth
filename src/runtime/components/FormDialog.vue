<template>
  <DialogBox
    v-model="isOpen"
    :title="title"
    :subtitle="subtitle"
    :loading="loading"
    :has-changes="hasChanges"
    :show-save-button="true"
    :save-text="saveText"
    :show-change-indicator="showChangeIndicator"
    :require-changes="requireChanges"
    :prevent-close="preventClose"
    :body-class="bodyClass"
    :ui="ui"
    @save="handleSave"
    @close="handleClose"
    @cancel="handleCancel"
  >
    <template
      v-if="$slots.actions"
      #actions
    >
      <slot name="actions" />
    </template>

    <slot />
  </DialogBox>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props - extends DialogBox props for forms
interface Props {
  /** Whether the dialog is open */
  modelValue: boolean
  /** Dialog title */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Loading state (disables interactions) */
  loading?: boolean
  /** Whether form has unsaved changes */
  hasChanges?: boolean
  /** Text for save button */
  saveText?: string
  /** Show change indicator */
  showChangeIndicator?: boolean
  /** Require changes before enabling save */
  requireChanges?: boolean
  /** Prevent closing the dialog during save */
  preventCloseDuringSave?: boolean
  /** Custom body padding class */
  bodyClass?: string
  /** Custom UI config */
  ui?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasChanges: false,
  saveText: 'Save Changes',
  showChangeIndicator: true,
  requireChanges: true,
  preventCloseDuringSave: true,
  bodyClass: 'p-6 space-y-4',
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

const preventClose = computed(() =>
  props.preventCloseDuringSave && props.loading,
)

// Methods
const handleSave = () => {
  emit('save')
}

const handleClose = () => {
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

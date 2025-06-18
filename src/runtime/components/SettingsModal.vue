<template>
  <UModal 
    v-model:open="isOpen" 
    :title="modalTitle"
    :dismissible="!isLoading"
    :overlay="true"
  >
    <template #body>
      <!-- Profile Settings -->
      <div v-if="activeTab === 'profile'">
        <ProfileForm 
          @saved="handleProfileSaved"
          @error="handleError"
        />
      </div>

      <!-- Team Settings -->
      <div v-else-if="activeTab === 'team'">
        <TeamForm 
          @saved="handleSettingsSaved"
          @error="handleError"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ProfileForm from './ProfileForm.vue'
import TeamForm from './TeamForm.vue'

// Props
interface Props {
  /** Whether the modal is open */
  modelValue: boolean
  /** Which settings tab to show */
  tab?: 'profile' | 'team'
}

const props = withDefaults(defineProps<Props>(), {
  tab: 'profile'
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [data: any]
  error: [error: string]
}>()

// Local state
const isLoading = ref(false)
const activeTab = ref(props.tab)

// Computed properties
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const modalTitle = computed(() => {
  switch (activeTab.value) {
    case 'profile':
      return 'Edit Profile'
    case 'team':
      return 'Team Settings'
    default:
      return 'Settings'
  }
})

// Watch for tab changes
watch(() => props.tab, (newTab) => {
  activeTab.value = newTab
})

// Methods
const closeModal = () => {
  if (!isLoading.value) {
    isOpen.value = false
  }
}

const handleProfileSaved = (data: any) => {
  emit('saved', data)
  // Optionally close modal after save
  // closeModal()
}

const handleSettingsSaved = (data: any) => {
  emit('saved', data)
  // Optionally close modal after save
  // closeModal()
}

const handleError = (error: string) => {
  emit('error', error)
}

// Set loading state for external control
const setLoading = (loading: boolean) => {
  isLoading.value = loading
}

// Expose methods for parent components
defineExpose({
  setLoading,
  closeModal
})
</script>
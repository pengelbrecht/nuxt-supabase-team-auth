<template>
  <UModal
    v-model:open="isOpen"
    :title="modalTitle"
    :description="modalDescription"
    :dismissible="!isLoading"
    :overlay="true"
  >
    <template #body>
      <!-- Profile Settings -->
      <div v-if="activeTab === 'profile'">
        <ProfileForm
          :is-modal="true"
          @saved="handleProfileSaved"
          @error="handleError"
        />
      </div>

      <!-- Team Settings -->
      <div v-else-if="activeTab === 'team'">
        <TeamForm
          :is-modal="true"
          @saved="handleSettingsSaved"
          @error="handleError"
        />
      </div>

      <!-- Impersonation Settings -->
      <div v-else-if="activeTab === 'impersonation'">
        <SuperAdminImpersonationContent />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ProfileForm from './ProfileForm.vue'
import TeamForm from './TeamForm.vue'
import SuperAdminImpersonationContent from './SuperAdminImpersonationContent.vue'

// Props
interface Props {
  /** Whether the modal is open */
  modelValue: boolean
  /** Which settings tab to show */
  tab?: 'profile' | 'team' | 'impersonation'
}

const props = withDefaults(defineProps<Props>(), {
  tab: 'profile',
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [data: any]
  'error': [error: string]
}>()

// Local state
const isLoading = ref(false)
const activeTab = ref(props.tab)

// Computed properties
const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const modalTitle = computed(() => {
  switch (activeTab.value) {
    case 'profile':
      return 'Edit Profile'
    case 'team':
      return 'Team Settings'
    case 'impersonation':
      return 'Start Impersonation'
    default:
      return 'Settings'
  }
})

const modalDescription = computed(() => {
  switch (activeTab.value) {
    case 'profile':
      return 'Manage your personal profile information and account settings'
    case 'team':
      return 'Manage team information, members, and organization settings'
    case 'impersonation':
      return 'Select a user to impersonate for support and debugging purposes'
    default:
      return 'Manage your account and team settings'
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
  closeModal,
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

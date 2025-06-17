<template>
  <UModal 
    v-model:open="isOpen" 
    :title="modalTitle"
    :dismissible="!isLoading"
    :overlay="true"
  >
    <template #body>
      <div class="max-h-[70vh] overflow-y-auto">
        <!-- Profile Settings -->
        <div v-if="activeTab === 'profile'">
          <ProfileForm 
            @saved="handleProfileSaved"
            @error="handleError"
          />
        </div>

        <!-- Team Settings (placeholder) -->
        <div v-else-if="activeTab === 'team'" class="p-8 text-center">
          <UIcon name="i-lucide-users" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Team Settings
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Team management features coming soon.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ProfileForm from './ProfileForm.vue'

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
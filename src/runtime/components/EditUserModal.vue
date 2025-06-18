<template>
  <UModal 
    v-model:open="modalOpen" 
    :ui="{ width: 'sm:max-w-2xl' }"
  >
    <template #header>
      <div class="flex justify-between items-center w-full">
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit User: {{ displayName }}
          </h2>
          <p v-if="isLoading" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Loading user information...
          </p>
        </div>
        <div class="flex items-center gap-3 ml-4">
          <span
            v-if="hasChanges"
            class="text-sm text-amber-600 dark:text-amber-400 font-medium"
          >
            You have unsaved changes
          </span>
          <UButton
            color="primary"
            variant="solid"
            size="md"
            :loading="isSaving"
            :disabled="isLoading || !hasChanges"
            class="min-w-[120px]"
            @click="handleSave"
          >
            Save Changes
          </UButton>
          <UButton
            color="gray"
            variant="ghost"
            size="md"
            icon="i-heroicons-x-mark-20-solid"
            :disabled="isSaving"
            @click="handleClose"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div class="p-6">
        <div v-if="!userId" class="text-center py-8 text-gray-500">
          No user selected
        </div>
        <div v-else-if="isLoading" class="text-center py-8 text-gray-500">
          Loading user information...
        </div>
        <UserProfileForm
          v-else
          ref="formRef"
          :user-id="userId"
          :is-modal="true"
          :loading="isSaving"
          @saved="handleSaved"
          @error="handleError"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import UserProfileForm from './UserProfileForm.vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import type { Profile } from '../types'

// Props
interface Props {
  open: boolean
  userId?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [profile: Profile]
  error: [error: string]
}>()

// Get auth state and functions
const { getTeamMemberProfile } = useTeamAuth()

// Component state
const isLoading = ref(false)
const isSaving = ref(false)
const userProfile = ref<Profile | null>(null)
const formRef = ref<InstanceType<typeof UserProfileForm> | null>(null)

// Toast for notifications
const toast = useToast()

// Computed properties
const modalOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const displayName = computed(() => {
  if (isLoading.value) return 'Loading...'
  return userProfile.value?.full_name || userProfile.value?.email || 'Unknown User'
})

const hasChanges = computed(() => {
  return formRef.value?.hasChanges || false
})

// Load user profile data for display name
const loadUserProfile = async () => {
  if (!props.userId) return

  try {
    isLoading.value = true
    userProfile.value = await getTeamMemberProfile(props.userId)
  }
  catch (error: any) {
    console.error('Failed to load user profile:', error)
    toast.add({
      title: 'Load Failed',
      description: error.message || 'Failed to load user information',
      color: 'red',
    })
    emit('error', error.message)
  }
  finally {
    isLoading.value = false
  }
}

// Handle save action
const handleSave = async () => {
  if (!formRef.value) return

  try {
    isSaving.value = true
    await formRef.value.handleSubmit()
  }
  catch (error: any) {
    console.error('Save failed:', error)
    // Error handling is done in UserProfileForm
  }
  finally {
    isSaving.value = false
  }
}

// Handle close action
const handleClose = () => {
  if (isSaving.value) return
  emit('update:open', false)
}

// Handle saved event from form
const handleSaved = (profile: Profile) => {
  // Update local profile data
  if (userProfile.value) {
    userProfile.value = { ...userProfile.value, ...profile }
  }
  
  emit('saved', profile)
  emit('update:open', false)
}

// Handle error event from form
const handleError = (error: string) => {
  emit('error', error)
}

// Watch for modal open/userId changes to load profile
watch([() => props.open, () => props.userId], ([isOpen, userId]) => {
  if (isOpen && userId) {
    loadUserProfile()
  }
}, { immediate: true })
</script>
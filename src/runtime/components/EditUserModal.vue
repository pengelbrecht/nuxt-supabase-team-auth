<template>
  <FormDialog
    v-model="modalOpen"
    :title="`Edit User: ${displayName}`"
    :subtitle="isLoading ? 'Loading user information...' : undefined"
    :has-changes="hasChanges"
    :loading="isSaving"
    save-text="Save Changes"
    @save="handleSave"
    @close="handleClose"
  >
    <div
      v-if="!userId"
      class="text-center py-8 text-gray-500"
    >
      No user selected
    </div>
    <div
      v-else-if="isLoading"
      class="text-center py-8 text-gray-500"
    >
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
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import type { Profile } from '../types'
import { useToast } from '#imports'
import UserProfileForm from './UserProfileForm.vue'

// Props
interface Props {
  open: boolean
  userId?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [profile: Profile]
  'error': [error: string]
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
  set: (value: boolean) => emit('update:open', value),
})

const displayName = computed(() => {
  if (isLoading.value) return 'Loading...'
  return userProfile.value?.full_name || userProfile.value?.email || 'Unknown User'
})

const hasChanges = computed(() => {
  if (!formRef.value) return false
  return formRef.value.hasChanges
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
      color: 'error',
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

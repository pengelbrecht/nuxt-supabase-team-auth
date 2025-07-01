<template>
  <div>
    <!-- Profile Information Form -->
    <UForm
      :schema="profileSchema"
      :state="form"
      class="space-y-8"
      @submit="handleSubmit"
    >
      <UCard
        variant="subtle"
        class="mb-6"
      >
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ isEditingSelf ? 'Profile' : 'User Information' }}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ isEditingSelf ? 'These informations will be displayed publicly.' : `Editing profile for ${targetUserName}` }}
          </p>
        </template>

        <!-- User Card -->
        <UserCard
          :name="form.full_name || profileData?.full_name"
          :email="form.email"
          class="mb-4"
        />

        <UFormField
          label="Full Name"
          name="full_name"
          class="flex items-center justify-between mb-4 gap-2"
        >
          <UInput
            v-model="form.full_name"
            placeholder="Enter full name"
            :disabled="isLoading || readonly"
            size="md"
          />
        </UFormField>

        <UFormField
          label="Email Address"
          name="email"
          required
          class="flex items-center justify-between mb-4 gap-2"
        >
          <UInput
            v-model="form.email"
            type="email"
            disabled
            class="opacity-60"
            size="md"
          />
        </UFormField>
      </UCard>
    </UForm>

    <!-- Password Section - Only show when editing self -->
    <UCard
      v-if="isEditingSelf && !isModal"
      variant="subtle"
      class="mb-6"
    >
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Password
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Update your password to keep your account secure.
        </p>
      </template>

      <UFormField
        label="New Password"
        name="password"
        class="flex items-center justify-between mb-4 gap-2"
      >
        <UInput
          v-model="form.password"
          type="password"
          placeholder="Enter new password"
          :disabled="isPasswordLoading"
          size="md"
        />
      </UFormField>

      <UFormField
        label="Confirm Password"
        name="confirmPassword"
        class="flex items-center justify-between mb-4 gap-2"
      >
        <UInput
          v-model="form.confirmPassword"
          type="password"
          placeholder="Confirm new password"
          :disabled="isPasswordLoading"
          size="md"
        />
      </UFormField>

      <div class="flex justify-end">
        <UButton
          type="button"
          variant="outline"
          size="md"
          :loading="isPasswordLoading"
          :disabled="!form.password || !form.confirmPassword"
          @click="handlePasswordUpdate"
        >
          Update Password
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import * as v from 'valibot'
import { useTeamAuth } from '../composables/useTeamAuth'
import type { Profile } from '../types'
import UserCard from './UserCard.vue'
import { useToast } from '#imports'

// Form validation schema
const profileSchema = v.object({
  full_name: v.pipe(v.string(), v.minLength(1, 'Full name is required')),
  email: v.pipe(v.string(), v.email()),
})

// Props
interface Props {
  /** User ID to edit. If not provided, edits current user */
  userId?: string
  /** Whether shown in a modal (affects layout) */
  isModal?: boolean
  /** View-only mode */
  readonly?: boolean
  /** Loading state from parent */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isModal: false,
  readonly: false,
  loading: false,
})

// Emits
const emit = defineEmits<{
  saved: [profile: any]
  error: [error: string]
}>()

// Get auth state and functions
const {
  currentUser,
  currentProfile,
  getProfile,
  updateProfile,
  getTeamMemberProfile,
  updateTeamMemberProfile,
} = useTeamAuth()

// Component state
const isLoading = ref(false)
const isPasswordLoading = ref(false)
const profileData = ref<Profile | null>(null)

// Toast for notifications
const toast = useToast()

// Form state
const form = reactive({
  full_name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// Store original values for change detection
const originalForm = ref<typeof form>({ ...form })

// Computed properties
const isEditingSelf = computed(() => !props.userId || props.userId === currentUser.value?.id)
const targetUserName = computed(() => profileData.value?.full_name || form.email || 'User')

const hasChanges = computed(() => {
  const fieldsToCompare = ['full_name', 'email']

  return fieldsToCompare.some((field) => {
    const formValue = form[field as keyof typeof form] || ''
    const originalValue = originalForm.value[field as keyof typeof form] || ''
    return formValue !== originalValue
  })
})

// Load profile data
const loadProfileData = async () => {
  try {
    isLoading.value = true

    if (isEditingSelf.value) {
      // Load current user's profile
      if (!currentProfile.value) {
        profileData.value = await getProfile()
      }
      else {
        profileData.value = currentProfile.value
      }
    }
    else if (props.userId) {
      // Load other user's profile
      profileData.value = await getTeamMemberProfile(props.userId)
    }

    // Initialize form with profile data
    if (profileData.value) {
      form.full_name = profileData.value.full_name || ''
      form.email = profileData.value.email || currentUser.value?.email || ''
    }
    else if (isEditingSelf.value && currentUser.value) {
      // Fallback for self editing
      form.full_name = currentUser.value.user_metadata?.name || ''
      form.email = currentUser.value.email || ''
    }

    // Reset password fields
    form.password = ''
    form.confirmPassword = ''

    // Store original values
    originalForm.value = { ...form }
  }
  catch (error: any) {
    console.error('Failed to load profile:', error)
    toast.add({
      title: 'Load Failed',
      description: error.message || 'Failed to load profile data',
      color: 'red',
    })
    emit('error', error.message)
  }
  finally {
    isLoading.value = false
  }
}

// Form submission
const handleSubmit = async () => {
  if (props.readonly || !hasChanges.value) return

  try {
    isLoading.value = true

    // Prepare update data
    const updateData: Partial<Profile> = {
      full_name: form.full_name,
    }

    // Call appropriate update function
    if (isEditingSelf.value) {
      await updateProfile(updateData)
    }
    else if (props.userId) {
      await updateTeamMemberProfile(props.userId, updateData)
    }

    // Update original form values
    originalForm.value = { ...form }

    // Only show toast when not in modal mode (let parent handle modal toasts)
    if (!props.isModal) {
      toast.add({
        title: 'Profile Updated',
        description: isEditingSelf.value
          ? 'Your profile has been updated successfully.'
          : `${targetUserName.value}'s profile has been updated.`,
        color: 'green',
      })
    }

    emit('saved', updateData)
  }
  catch (error: any) {
    console.error('Profile update error:', error)

    // Only show toast when not in modal mode (let parent handle modal toasts)
    if (!props.isModal) {
      toast.add({
        title: 'Update Failed',
        description: error.message || 'Failed to update profile. Please try again.',
        color: 'red',
      })
    }

    emit('error', error.message)
  }
  finally {
    isLoading.value = false
  }
}

// Password update (self only)
const handlePasswordUpdate = async () => {
  if (!isEditingSelf.value) return

  try {
    isPasswordLoading.value = true

    // Validate password confirmation
    if (form.password !== form.confirmPassword) {
      toast.add({
        title: 'Password Mismatch',
        description: 'Passwords do not match',
        color: 'red',
      })
      return
    }

    // Update password
    await updateProfile({ password: form.password })

    // Clear password fields
    form.password = ''
    form.confirmPassword = ''

    toast.add({
      title: 'Password Updated',
      description: 'Your password has been changed successfully.',
      color: 'green',
    })
  }
  catch (error: any) {
    console.error('Password update error:', error)
    toast.add({
      title: 'Update Failed',
      description: error.message || 'Failed to update password. Please try again.',
      color: 'red',
    })
  }
  finally {
    isPasswordLoading.value = false
  }
}

// Watch for userId changes
watch(() => props.userId, () => {
  loadProfileData()
})

// Watch for external loading state
watch(() => props.loading, (newVal) => {
  isLoading.value = newVal
})

// Initialize on mount
onMounted(() => {
  loadProfileData()
})

// Expose methods for parent components
defineExpose({
  handleSubmit,
  hasChanges,
})
</script>

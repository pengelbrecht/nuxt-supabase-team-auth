<template>
  <SettingsTabContainer>
    <!-- Error Messages Only - Success shown in button -->
    <div v-if="message?.type === 'error'" class="mb-6">
      <UAlert
        color="red"
        title="Error"
        :description="message.text"
        @close="message = null"
      />
    </div>

    <UCard class="w-full">
      <template #header>
        <!-- Save Button at Top -->
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Profile Settings
          </h2>
          <div class="flex items-center gap-3">
            <span
              v-if="hasChanges"
              class="text-sm text-amber-600 dark:text-amber-400 font-medium"
            >
              You have unsaved changes
            </span>
            <UButton
              type="button"
              :loading="isProfileLoading"
              :disabled="!hasChanges && !isProfileSaved"
              :color="isProfileSaved ? 'green' : 'primary'"
              :icon="isProfileSaved ? 'i-lucide-check' : undefined"
              size="md"
              class="min-w-[120px]"
              @click="handleSubmit"
            >
              {{ getSubmitButtonText() }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-8">
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
              Profile
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              These informations will be displayed publicly.
            </p>
          </template>

          <!-- User Card -->
          <UserCard
            :name="form.full_name || currentProfile?.full_name"
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
              placeholder="Enter your full name"
              :disabled="isProfileLoading"
              size="md"
            />
          </UFormField>

          <UFormField
            label="Email Address"
            name="email"
            required
            class="flex items-center justify-between not-last:pb-4 gap-2"
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

      <!-- Security Settings - Separate Form -->
      <UCard variant="subtle">
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Security Settings
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your account security and password.
          </p>
        </template>

        <!-- Password Change Section -->
        <div class="mb-6">
          <h4 class="font-medium text-gray-900 dark:text-gray-100">
            Password
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Update your account password for better security.
          </p>
        </div>

        <div class="flex items-center justify-between mb-4 gap-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
          <div class="flex-1">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="Enter new password"
              :disabled="isPasswordLoading"
              size="md"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must be at least 8 characters with numbers and letters.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between mb-4 gap-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
          <div class="flex-1">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="Confirm new password"
              :disabled="isPasswordLoading"
              size="md"
            />
          </div>
        </div>

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
    </UCard>
  </SettingsTabContainer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import * as v from 'valibot'
import { useTeamAuth } from '../composables/useTeamAuth'
import UserCard from './UserCard.vue'
import SettingsTabContainer from './SettingsTabContainer.vue'

// Form validation schema - only for profile fields
const profileSchema = v.object({
  full_name: v.pipe(v.string(), v.minLength(1, 'Full name is required')),
  email: v.pipe(v.string(), v.email()),
  avatar_url: v.optional(v.string()),
})

// Props
interface Props {
  /** Custom card class */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {})

// Emits
const emit = defineEmits<{
  saved: [profile: any]
  error: [error: string]
}>()

// Get auth state
const { currentUser, currentProfile, getProfile, updateProfile, getAvatarFallback } = useTeamAuth()

// Component state
const isProfileLoading = ref(false)
const isPasswordLoading = ref(false)
const isProfileSaved = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)

// Form state
const form = reactive({
  full_name: '',
  email: '',
  password: '',
  confirmPassword: '',
  avatar_url: '',
})

// Store original values for change detection
const originalForm = ref<{
  full_name?: string
  email?: string
  password?: string
  confirmPassword?: string
  avatar_url?: string
}>({})

// Computed properties
const avatarFallback = computed(() => {
  // Use shared avatar fallback logic with ProfileForm-specific overrides
  const fullNameOverride = form.full_name || currentProfile.value?.full_name
  const emailOverride = form.email

  return getAvatarFallback({
    fullName: fullNameOverride,
    email: emailOverride,
  })
})

const hasChanges = computed(() => {
  // Create copies without password fields for comparison
  const formForComparison = {
    full_name: form.full_name,
    email: form.email,
  }

  const originalForComparison = {
    full_name: originalForm.value.full_name || '',
    email: originalForm.value.email || '',
  }

  // Check if profile values differ from original values (excluding passwords)
  const formChanged = JSON.stringify(formForComparison) !== JSON.stringify(originalForComparison)

  // For new profiles, allow submit if user has entered a valid full name AND it's different from original
  const isNewProfileWithName = !originalForm.value.full_name && form.full_name && form.full_name.trim().length > 0

  return formChanged || isNewProfileWithName
})

// Initialize form with current user data
const initializeForm = () => {
  if (currentUser.value) {
    // Use profile data if available, fallback to user_metadata, then empty string
    form.full_name = currentProfile.value?.full_name || currentUser.value.user_metadata?.name || ''
    form.email = currentUser.value.email || ''
    form.avatar_url = ''
    form.password = ''
    form.confirmPassword = ''

    // Store original values
    originalForm.value = { ...form }
  }
}

// Form submission
const handleSubmit = async () => {
  try {
    isProfileLoading.value = true
    message.value = null

    // Validate password confirmation
    if (form.password && form.password !== form.confirmPassword) {
      message.value = { type: 'error', text: 'Passwords do not match' }
      return
    }

    // Prepare update data
    const updateData: any = {
      full_name: form.full_name,
    }

    if (form.password) {
      updateData.password = form.password
    }

    // Avatar URL is not user-editable in this version

    // Call updateProfile from composable
    await updateProfile(updateData)

    // Update original form values to reflect saved state
    originalForm.value = { ...form }

    // Show success in button briefly
    isProfileSaved.value = true
    setTimeout(() => {
      isProfileSaved.value = false
    }, 2000)

    // Clear password fields
    form.password = ''
    form.confirmPassword = ''

    emit('saved', updateData)
  }
  catch (error: any) {
    console.error('Profile update error:', error)
    message.value = {
      type: 'error',
      text: error.message || 'Failed to update profile. Please try again.',
    }
    emit('error', error.message)
  }
  finally {
    isProfileLoading.value = false
  }
}

// Reset form to original values
const resetForm = () => {
  Object.assign(form, originalForm.value)
  message.value = null
}

// Handle password update separately
const handlePasswordUpdate = async () => {
  try {
    if (!form.password || !form.confirmPassword) {
      message.value = { type: 'error', text: 'Please fill in both password fields' }
      return
    }

    if (form.password !== form.confirmPassword) {
      message.value = { type: 'error', text: 'Passwords do not match' }
      return
    }

    isPasswordLoading.value = true
    message.value = null

    // Update only the password
    await updateProfile({ password: form.password })

    message.value = { type: 'success', text: 'Password updated successfully!' }

    // Clear password fields
    form.password = ''
    form.confirmPassword = ''
  }
  catch (error: any) {
    console.error('Password update error:', error)
    message.value = {
      type: 'error',
      text: error.message || 'Failed to update password. Please try again.',
    }
  }
  finally {
    isPasswordLoading.value = false
  }
}

// Get submit button text based on state
const getSubmitButtonText = () => {
  if (isProfileSaved.value) return 'Saved!'
  return 'Save Profile'
}

// Watch for profile changes from the composable - initialize whenever either changes
watch([currentUser, currentProfile], () => {
  initializeForm()
}, { immediate: true })

// Also watch for when profile data becomes available (goes from null to data)
watch(() => currentProfile.value?.full_name, () => {
  if (currentProfile.value?.full_name && !form.full_name) {
    initializeForm()
  }
})

// Clear success state when user makes changes
watch(() => form.full_name, () => {
  if (isProfileSaved.value) {
    isProfileSaved.value = false
  }
})
</script>

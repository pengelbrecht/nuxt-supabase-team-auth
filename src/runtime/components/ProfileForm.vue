<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Profile Settings
      </h3>
    </template>

    <UForm :schema="profileSchema" :state="form" @submit="handleSubmit" class="space-y-8">
      <!-- Avatar Section -->
      <div class="flex items-start gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <UAvatar
          :src="form.avatar_url || currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url || undefined"
          :alt="form.full_name || currentProfile?.full_name || currentUser?.user_metadata?.full_name || 'User'"
          size="xl"
        >
          {{ avatarFallback }}
        </UAvatar>
        
        <div class="flex-1 space-y-2">
          <UFormField label="Profile Picture" name="avatar" class="mb-0">
            <UInput
              type="file"
              accept="image/*"
              @change="handleAvatarChange"
              :disabled="isProfileLoading"
              class="cursor-pointer"
            />
          </UFormField>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            JPG, GIF or PNG. Max size 2MB.
          </p>
        </div>
      </div>

      <!-- Basic Information -->
      <div>
        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
          Basic Information
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField label="Full Name" name="full_name" required>
            <UInput
              v-model="form.full_name"
              placeholder="Enter your full name"
              :disabled="isProfileLoading"
              size="md"
            />
          </UFormField>

          <UFormField label="Email Address" name="email">
            <UInput
              v-model="form.email"
              type="email"
              disabled
              class="opacity-60"
              size="md"
            />
            <template #help>
              Email cannot be changed. Contact support if needed.
            </template>
          </UFormField>
        </div>
      </div>

      <!-- Security Settings -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-8">
        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-6">
          Security Settings
        </h4>
        
        <div class="space-y-6">

          <!-- Password Change Section -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h5 class="font-medium text-gray-900 dark:text-gray-100">Change Password</h5>
                <p class="text-sm text-gray-600 dark:text-gray-400">Update your account password</p>
              </div>
              <UButton
                v-if="!showPasswordFields"
                type="button"
                variant="outline"
                size="sm"
                @click="showPasswordFields = true"
                :disabled="isProfileLoading"
              >
                Change Password
              </UButton>
            </div>
            
            <div v-if="showPasswordFields" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <UFormField label="New Password" name="password">
                  <UInput
                    v-model="form.password"
                    type="password"
                    placeholder="Enter new password"
                    :disabled="isProfileLoading"
                    size="md"
                  />
                </UFormField>

                <UFormField label="Confirm Password" name="confirmPassword">
                  <UInput
                    v-model="form.confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    :disabled="isProfileLoading"
                    size="md"
                  />
                </UFormField>
              </div>
              
              <div class="flex gap-2">
                <UButton
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="cancelPasswordChange"
                  :disabled="isProfileLoading"
                >
                  Cancel
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-700">
        <div class="flex gap-3">
          <UButton
            type="button"
            :loading="isProfileLoading"
            :disabled="!hasChanges"
            size="md"
            class="min-w-[120px]"
            @click="handleSubmit"
          >
            {{ getSubmitButtonText() }}
          </UButton>
          
          <UButton
            variant="outline"
            @click="resetForm"
            :disabled="isProfileLoading"
            size="md"
          >
            Reset
          </UButton>
        </div>
        
        <div v-if="hasChanges" class="text-sm text-amber-600 dark:text-amber-400 font-medium">
          You have unsaved changes
        </div>
      </div>
    </UForm>

    <!-- Success/Error Messages -->
    <div v-if="message" class="mt-4">
      <UAlert
        :color="message.type === 'success' ? 'green' : 'red'"
        :title="message.type === 'success' ? 'Success' : 'Error'"
        :description="message.text"
        @close="message = null"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import * as v from 'valibot'

// Form validation schema
const profileSchema = v.object({
  full_name: v.pipe(v.string(), v.minLength(1, 'Full name is required')),
  email: v.pipe(v.string(), v.email()),
  password: v.optional(v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters'))),
  confirmPassword: v.optional(v.string()),
  avatar: v.optional(v.any()),
  avatar_url: v.optional(v.string())
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
const { currentUser, getProfile, updateProfile } = useTeamAuth()

// Component state
const isProfileLoading = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)
const showPasswordFields = ref(false)
const currentProfile = ref<any>(null)

// Form state
const form = reactive({
  full_name: '',
  email: '',
  password: '',
  confirmPassword: '',
  avatar_url: '',
  avatar: null as File | null
})

// Store original values for change detection
const originalForm = ref({})

// Computed properties
const avatarFallback = computed(() => {
  // Try profile data first, then form data, then user metadata
  const fullName = form.full_name || currentProfile.value?.full_name || currentUser.value?.user_metadata?.full_name
  const email = form.email || currentUser.value?.email
  
  // Get initials from full name if available
  if (fullName && fullName.trim()) {
    return fullName
      .trim()
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  // Fallback to first letter of email
  if (email) {
    return email[0].toUpperCase()
  }
  
  return 'U'
})

const hasChanges = computed(() => {
  // Check if form values differ from original values
  const formChanged = JSON.stringify(form) !== JSON.stringify(originalForm.value)
  
  // Also allow submit if user has entered a valid full name (for new profiles)
  const hasValidName = form.full_name && form.full_name.trim().length > 0
  
  return formChanged || hasValidName
})


// Load user profile data
const loadProfile = async () => {
  try {
    if (!currentUser.value) return
    
    isProfileLoading.value = true
    currentProfile.value = await getProfile()
    initializeForm()
  } catch (error) {
    console.error('Failed to load profile:', error)
    message.value = { type: 'error', text: 'Failed to load profile data' }
  } finally {
    isProfileLoading.value = false
  }
}

// Initialize form with current user data
const initializeForm = () => {
  if (currentUser.value) {
    // Use profile data if available, fallback to user_metadata, then empty string
    form.full_name = currentProfile.value?.full_name || currentUser.value.user_metadata?.full_name || ''
    form.email = currentUser.value.email || ''
    form.avatar_url = currentProfile.value?.avatar_url || currentUser.value.user_metadata?.avatar_url || ''
    form.password = ''
    form.confirmPassword = ''
    form.avatar = null
    
    // Store original values
    originalForm.value = { ...form }
  }
}

// File upload handler
const handleAvatarChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      message.value = { type: 'error', text: 'File size must be less than 2MB' }
      target.value = ''
      return
    }
    
    // Set the file in form
    form.avatar = file
    
    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      form.avatar_url = e.target?.result as string
    }
    reader.readAsDataURL(file)
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
      full_name: form.full_name
    }
    
    if (form.password) {
      updateData.password = form.password
    }
    
    if (form.avatar_url !== (currentProfile.value?.avatar_url || '')) {
      updateData.avatar_url = form.avatar_url
    }
    
    // Call updateProfile from composable
    await updateProfile(updateData)
    
    // Update original form values to reflect saved state
    originalForm.value = { ...form }
    
    message.value = { type: 'success', text: 'Profile updated successfully!' }
    
    // Clear password fields
    form.password = ''
    form.confirmPassword = ''
    
    emit('saved', updateData)
    
  } catch (error: any) {
    console.error('Profile update error:', error)
    message.value = { 
      type: 'error', 
      text: error.message || 'Failed to update profile. Please try again.' 
    }
    emit('error', error.message)
  } finally {
    isProfileLoading.value = false
  }
}

// Reset form to original values
const resetForm = () => {
  Object.assign(form, originalForm.value)
  message.value = null
  showPasswordFields.value = false
}

// Cancel password change
const cancelPasswordChange = () => {
  form.password = ''
  form.confirmPassword = ''
  showPasswordFields.value = false
}

// Get submit button text based on what's being updated
const getSubmitButtonText = () => {
  const hasPasswordChanges = form.password || form.confirmPassword
  const hasProfileChanges = hasChanges.value && !hasPasswordChanges
  
  if (hasPasswordChanges && hasProfileChanges) {
    return 'Save Profile & Password'
  } else if (hasPasswordChanges) {
    return 'Change Password'
  } else if (hasProfileChanges) {
    return 'Save Profile'
  }
  
  return 'Save Changes'
}

// Watch for user changes (only when user ID actually changes)
watch(() => currentUser.value?.id, (newUserId, oldUserId) => {
  if (newUserId && newUserId !== oldUserId) {
    loadProfile()
  }
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (currentUser.value) {
    loadProfile()
  }
})
</script>
<template>
  <div v-if="isModal" class="space-y-6">
    <!-- Error Messages Only - Success shown in button -->
    <div
      v-if="message?.type === 'error'"
      class="mb-6"
    >
      <UAlert
        color="red"
        title="Error"
        :description="message.text"
        @close="message = null"
      />
    </div>

    <!-- Use UserProfileForm component -->
    <UserProfileForm
      ref="userProfileFormRef"
      :is-modal="true"
      :loading="isProfileLoading"
      @saved="handleFormSaved"
      @error="handleFormError"
    />
  </div>

  <SettingsTabContainer v-else>
    <!-- Error Messages Only - Success shown in button -->
    <div
      v-if="message?.type === 'error'"
      class="mb-6"
    >
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
        <!-- Use UserProfileForm component -->
        <UserProfileForm
          ref="userProfileFormRef"
          :loading="isProfileLoading"
          @saved="handleFormSaved"
          @error="handleFormError"
        />
      </div>
    </UCard>
  </SettingsTabContainer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import UserProfileForm from './UserProfileForm.vue'
import SettingsTabContainer from './SettingsTabContainer.vue'

// Props
interface Props {
  /** Custom card class */
  class?: string
  /** Whether shown in a modal (skips outer card wrapper) */
  isModal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isModal: false,
})

// Emits
const emit = defineEmits<{
  saved: [profile: any]
  error: [error: string]
}>()

// Component state
const isProfileLoading = ref(false)
const isProfileSaved = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)

// Template ref for UserProfileForm
const userProfileFormRef = ref<InstanceType<typeof UserProfileForm> | null>(null)

// Computed properties
const hasChanges = computed(() => {
  return userProfileFormRef.value?.hasChanges || false
})

// Form submission - delegate to UserProfileForm
const handleSubmit = async () => {
  if (!userProfileFormRef.value) return

  try {
    isProfileLoading.value = true
    message.value = null

    // Call the UserProfileForm's handleSubmit method
    await userProfileFormRef.value.handleSubmit()

    // Show success in button briefly
    isProfileSaved.value = true
    setTimeout(() => {
      isProfileSaved.value = false
    }, 2000)
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

// Handle form saved event from UserProfileForm
const handleFormSaved = (profile: any) => {
  // Show success in button briefly
  isProfileSaved.value = true
  setTimeout(() => {
    isProfileSaved.value = false
  }, 2000)

  // Emit to parent
  emit('saved', profile)
}

// Handle form error event from UserProfileForm
const handleFormError = (error: string) => {
  message.value = {
    type: 'error',
    text: error,
  }
  emit('error', error)
}

// Get submit button text based on state
const getSubmitButtonText = () => {
  if (isProfileSaved.value) return 'Saved!'
  return 'Save Profile'
}
</script>

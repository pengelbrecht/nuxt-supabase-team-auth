<template>
  <FormDialog
    v-model="isOpen"
    title="Company Settings"
    subtitle="Manage company information and billing details"
    :has-changes="hasChanges"
    :loading="isLoading"
    save-text="Save Changes"
    @save="handleSave"
    @close="handleClose"
  >
    <UForm
      :schema="companySchema"
      :state="form"
      class="space-y-6"
    >
      <!-- Basic Information -->
      <UCard
        variant="subtle"
        class="mb-6"
      >
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Basic Information
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Team and company details for your organization.
          </p>
        </template>

        <UFormField
          label="Team Name"
          name="name"
          required
          class="mb-4"
        >
          <UInput
            v-model="form.name"
            placeholder="Enter team name"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>

        <UFormField
          label="Company Name"
          name="company_name"
          class="mb-4"
        >
          <UInput
            v-model="form.company_name"
            placeholder="Legal company name"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>
      </UCard>

      <!-- Company Address -->
      <UCard
        variant="subtle"
        class="mb-6"
      >
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Company Address
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Address information for invoicing and legal purposes.
          </p>
        </template>

        <UFormField
          label="Address Line 1"
          name="company_address_line1"
          class="mb-4"
        >
          <UInput
            v-model="form.company_address_line1"
            placeholder="Street address"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>

        <UFormField
          label="Address Line 2"
          name="company_address_line2"
          class="mb-4"
        >
          <UInput
            v-model="form.company_address_line2"
            placeholder="Apartment, suite, etc. (optional)"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <UFormField
            label="City"
            name="company_city"
          >
            <UInput
              v-model="form.company_city"
              placeholder="City"
              :disabled="isLoading"
              size="md"
            />
          </UFormField>

          <UFormField
            label="State/Province"
            name="company_state"
          >
            <UInput
              v-model="form.company_state"
              placeholder="State or Province"
              :disabled="isLoading"
              size="md"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <UFormField
            label="Postal Code"
            name="company_postal_code"
          >
            <UInput
              v-model="form.company_postal_code"
              placeholder="ZIP or Postal Code"
              :disabled="isLoading"
              size="md"
            />
          </UFormField>

          <UFormField
            label="Country"
            name="company_country"
          >
            <UInput
              v-model="form.company_country"
              placeholder="Country"
              :disabled="isLoading"
              size="md"
            />
          </UFormField>
        </div>

        <UFormField
          label="VAT Number"
          name="company_vat_number"
          class="mb-4"
        >
          <UInput
            v-model="form.company_vat_number"
            placeholder="Tax/VAT identification number"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>
      </UCard>
    </UForm>
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import * as v from 'valibot'
import { useTeamAuth } from '../composables/useTeamAuth'
import { useToast } from '#imports'

// Form validation schema
const companySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Team name is required')),
  company_name: v.optional(v.string()),
  company_address_line1: v.optional(v.string()),
  company_address_line2: v.optional(v.string()),
  company_city: v.optional(v.string()),
  company_state: v.optional(v.string()),
  company_postal_code: v.optional(v.string()),
  company_country: v.optional(v.string()),
  company_vat_number: v.optional(v.string()),
})

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [team: Record<string, unknown>]
  'error': [error: string]
}>()

// Get auth state and functions
const { currentTeam, updateTeam } = useTeamAuth()

// Component state
const isLoading = ref(false)

// Toast notifications
const toast = useToast()

// Form state
const form = reactive({
  name: '',
  company_name: '',
  company_address_line1: '',
  company_address_line2: '',
  company_city: '',
  company_state: '',
  company_postal_code: '',
  company_country: '',
  company_vat_number: '',
})

// Store original values for change detection
const originalForm = ref<typeof form>({
  name: '',
  company_name: '',
  company_address_line1: '',
  company_address_line2: '',
  company_city: '',
  company_state: '',
  company_postal_code: '',
  company_country: '',
  company_vat_number: '',
})

// Computed properties
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const hasChanges = computed(() => {
  return JSON.stringify(form) !== JSON.stringify(originalForm.value)
})

// Initialize form with current team data
const initializeForm = () => {
  if (currentTeam.value) {
    // Copy all team data to form
    const team = currentTeam.value
    Object.keys(form).forEach((key) => {
      const formKey = key as keyof typeof form
      form[formKey] = (team[formKey as keyof typeof team] as string) || ''
    })
    originalForm.value = { ...form }
  }
}

// Form submission
const handleSave = async () => {
  try {
    isLoading.value = true

    // Update all team fields
    await updateTeam(form)

    originalForm.value = { ...form }
    toast.add({
      title: 'Company Settings Updated',
      description: 'Company information has been saved successfully.',
      color: 'success',
    })
    emit('saved', form)
    isOpen.value = false
  }
  catch (error) {
    console.error('Company update error:', error)
    toast.add({
      title: 'Update Failed',
      description: error instanceof Error ? error.message : 'Failed to update company settings. Please try again.',
      color: 'error',
    })
    emit('error', error instanceof Error ? error.message : 'Update failed')
  }
  finally {
    isLoading.value = false
  }
}

// Handle close
const handleClose = () => {
  // Reset form data if there are unsaved changes
  if (hasChanges.value) {
    form.name = originalForm.value.name
    form.company_name = originalForm.value.company_name
    form.company_address_line1 = originalForm.value.company_address_line1
    form.company_address_line2 = originalForm.value.company_address_line2
    form.company_city = originalForm.value.company_city
    form.company_state = originalForm.value.company_state
    form.company_postal_code = originalForm.value.company_postal_code
    form.company_country = originalForm.value.company_country
    form.company_vat_number = originalForm.value.company_vat_number
  }
}

// Watch for team changes
watch(() => currentTeam.value, () => {
  initializeForm()
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (currentTeam.value) {
    initializeForm()
  }
})
</script>

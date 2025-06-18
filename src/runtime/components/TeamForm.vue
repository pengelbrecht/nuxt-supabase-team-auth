<template>
  <SettingsTabContainer>
    <!-- Success/Error Messages -->
    <div v-if="message" class="mb-6">
      <UAlert
        :color="message.type === 'success' ? 'green' : 'red'"
        :title="message.type === 'success' ? 'Success' : 'Error'"
        :description="message.text"
        @close="message = null"
      />
    </div>

    <!-- Tabs -->
    <UTabs v-model="activeTab" :items="tabs" variant="link">
      <template #company>
        <UForm :schema="teamSchema" :state="form" @submit="handleSubmit" class="space-y-6">
          <UCard variant="subtle" class="mb-6">
                  <template #header>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Basic Information
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Team and company details for your organization.
                    </p>
                  </template>

                  <UFormField label="Team Name" name="name" required class="mb-4">
                    <UInput
                      v-model="form.name"
                      placeholder="Enter team name"
                      :disabled="isTeamLoading"
                      size="md"
                    />
                  </UFormField>

                  <UFormField label="Company Name" name="company_name" class="mb-4">
                    <UInput
                      v-model="form.company_name"
                      placeholder="Legal company name"
                      :disabled="isTeamLoading"
                      size="md"
                    />
                  </UFormField>
                </UCard>

            <!-- Company Address Section -->
            <UCard variant="subtle" class="mb-6">
              <template #header>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Company Address
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Address information for invoicing and legal purposes.
                </p>
              </template>

              <UFormField label="Address Line 1" name="company_address_line1" class="mb-4">
                <UInput
                  v-model="form.company_address_line1"
                  placeholder="Street address"
                  :disabled="isTeamLoading"
                  size="md"
                />
              </UFormField>

              <UFormField label="Address Line 2" name="company_address_line2" class="mb-4">
                <UInput
                  v-model="form.company_address_line2"
                  placeholder="Apartment, suite, etc. (optional)"
                  :disabled="isTeamLoading"
                  size="md"
                />
              </UFormField>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <UFormField label="City" name="company_city">
                  <UInput
                    v-model="form.company_city"
                    placeholder="City"
                    :disabled="isTeamLoading"
                    size="md"
                  />
                </UFormField>

                <UFormField label="State/Province" name="company_state">
                  <UInput
                    v-model="form.company_state"
                    placeholder="State or Province"
                    :disabled="isTeamLoading"
                    size="md"
                  />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <UFormField label="Postal Code" name="company_postal_code">
                  <UInput
                    v-model="form.company_postal_code"
                    placeholder="ZIP or Postal Code"
                    :disabled="isTeamLoading"
                    size="md"
                  />
                </UFormField>

                <UFormField label="Country" name="company_country">
                  <UInput
                    v-model="form.company_country"
                    placeholder="Country"
                    :disabled="isTeamLoading"
                    size="md"
                  />
                </UFormField>
              </div>

              <UFormField label="VAT Number" name="company_vat_number" class="mb-4">
                <UInput
                  v-model="form.company_vat_number"
                  placeholder="Tax/VAT identification number"
                  :disabled="isTeamLoading"
                  size="md"
                />
              </UFormField>
            </UCard>


            <!-- Save Button -->
            <div class="flex justify-end gap-3">
              <span v-if="hasChanges" class="text-sm text-amber-600 dark:text-amber-400 font-medium self-center">
                You have unsaved changes
              </span>
              <UButton
                type="submit"
                :loading="isTeamLoading"
                :disabled="!hasChanges"
                size="md"
                class="min-w-[120px]"
              >
                Save Changes
              </UButton>
            </div>
        </UForm>
      </template>

      <template #members>
        <UCard variant="subtle" class="mb-6">
              <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Team Members
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage your team members and their roles
                  </p>
                </div>
                <UButton
                  v-if="canInviteMembers"
                  icon="i-lucide-user-plus"
                  @click="showInviteModal = true"
                  :disabled="isInviteLoading"
                  size="sm"
                >
                  Invite Member
                </UButton>
              </div>
            </template>

            <!-- Team Members List -->
            <div v-if="teamMembers.length > 0" class="space-y-4">
              <div
                v-for="(member, index) in teamMembers"
                :key="member.id"
                class="flex items-center justify-between py-4"
                :class="{ 'border-b border-gray-200 dark:border-gray-700': index < teamMembers.length - 1 }"
              >
                <!-- Member Info -->
                <div class="flex items-center gap-4">
                  <UAvatar size="md">
                    {{ getMemberInitials(member) }}
                  </UAvatar>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {{ member.profile?.full_name || 'Unknown User' }}
                      <span v-if="member.user_id === currentUser?.id" class="text-sm text-gray-500 dark:text-gray-400 font-normal">(me)</span>
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ member.user?.email }}
                    </p>
                  </div>
                </div>

                <!-- Role and Actions -->
                <div class="flex items-center gap-3">
                  <USelect
                    v-if="canChangeRole(member)"
                    :model-value="member.role"
                    :options="roleOptions"
                    size="sm"
                    class="w-32"
                    @update:model-value="(newRole: string) => handleRoleChange(member, newRole)"
                  />
                  <UBadge v-else :color="getRoleColor(member.role)" variant="soft" size="sm">
                    {{ formatRole(member.role) }}
                  </UBadge>

                  <UDropdownMenu v-if="canManageMember(member)" :items="getMemberActions(member)">
                    <UButton variant="ghost" size="sm" icon="i-lucide-more-horizontal" />
                  </UDropdownMenu>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
              <UIcon name="i-lucide-users" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No team members
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Get started by inviting your first team member.
              </p>
              <UButton
                v-if="canInviteMembers"
                icon="i-lucide-user-plus"
                @click="showInviteModal = true"
              >
                Invite Member
              </UButton>
            </div>
        </UCard>
      </template>
    </UTabs>
  </SettingsTabContainer>

    <!-- Invite Member Modal -->
    <UModal v-model:open="showInviteModal" title="Invite Team Member">
      <template #body>
        <div class="p-6 space-y-4">
          <UFormField label="Email Address" required>
            <UInput
              v-model="inviteEmail"
              type="email"
              placeholder="member@company.com"
              :disabled="isInviteLoading"
              size="md"
            />
          </UFormField>

          <UFormField label="Role">
            <USelect
              v-model="inviteRole"
              :options="roleOptions"
              :disabled="isInviteLoading"
              size="md"
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton variant="ghost" @click="showInviteModal = false" :disabled="isInviteLoading">
              Cancel
            </UButton>
            <UButton
              :loading="isInviteLoading"
              :disabled="!inviteEmail || !inviteRole"
              @click="handleInviteMember"
            >
              Send Invitation
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import SettingsTabContainer from './SettingsTabContainer.vue'
import * as v from 'valibot'

// Form validation schema - expanded for company info
const teamSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Team name is required')),
  company_name: v.optional(v.string()),
  company_address_line1: v.optional(v.string()),
  company_address_line2: v.optional(v.string()),
  company_city: v.optional(v.string()),
  company_state: v.optional(v.string()),
  company_postal_code: v.optional(v.string()),
  company_country: v.optional(v.string()),
  company_vat_number: v.optional(v.string())
})

// Props
interface Props {
  /** Custom card class */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {})

// Emits
const emit = defineEmits<{
  saved: [team: any]
  error: [error: string]
}>()

// Get auth state
const { currentUser, currentTeam, currentRole, renameTeam, deleteTeam, inviteMember, getAvatarFallback } = useTeamAuth()

// Component state
const isTeamLoading = ref(false)
const isInviteLoading = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)
const showInviteModal = ref(false)
const teamMembers = ref<any[]>([])
const activeTab = ref('company') // Track active tab

// Form state - expanded for company info
const form = reactive({
  name: '',
  company_name: '',
  company_address_line1: '',
  company_address_line2: '',
  company_city: '',
  company_state: '',
  company_postal_code: '',
  company_country: '',
  company_vat_number: ''
})

// Invite state
const inviteEmail = ref('')
const inviteRole = ref('member')

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
  company_vat_number: ''
})

// Tab configuration
const tabs = [
  {
    key: 'company',
    label: 'Company Information',
    icon: 'i-lucide-building',
    slot: 'company',
    value: 'company'
  },
  {
    key: 'members',
    label: 'Team Members',
    icon: 'i-lucide-users',
    slot: 'members',
    value: 'members'
  }
]

// Computed properties
const hasChanges = computed(() => {
  return JSON.stringify(form) !== JSON.stringify(originalForm.value)
})

const canInviteMembers = computed(() => {
  return ['admin', 'owner'].includes(currentRole.value || '')
})

const roleOptions = computed(() => {
  const options = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' }
  ]
  
  // Only owners can assign owner role to others
  // Superadmin is never available in dropdown (system-level role)
  if (currentRole.value === 'owner') {
    options.push({ label: 'Owner', value: 'owner' })
  }
  
  return options
})

// Helper functions
const formatRole = (role: string | null | undefined) => {
  if (!role) return 'Unknown'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const getRoleColor = (role: string | null | undefined) => {
  if (!role) return 'gray'
  switch (role) {
    case 'super_admin': return 'red'
    case 'owner': return 'purple'
    case 'admin': return 'blue'
    default: return 'gray'
  }
}

const getMemberInitials = (member: any) => {
  return getAvatarFallback({
    fullName: member.profile?.full_name,
    email: member.user?.email
  })
}

const canManageMember = (member: any) => {
  // Owner can manage everyone except themselves
  // Admin can manage members but not other admins or owners
  if (currentRole.value === 'owner' && member.user_id !== currentUser.value?.id) {
    return true
  }
  if (currentRole.value === 'admin' && member.role === 'member') {
    return true
  }
  return false
}

const canChangeRole = (member: any) => {
  // Never allow role changes for superadmin users (system-level role)
  if (member.role === 'super_admin') {
    return false
  }
  
  // For demo purposes, always show the role selector but disable for certain cases
  // Owner can change anyone's role except superadmins
  // Admin can only change member roles, not other admins or owners
  if (currentRole.value === 'owner') {
    return true // Show for everyone, but we'll handle restrictions in the change handler
  }
  if (currentRole.value === 'admin' && member.role === 'member') {
    return true
  }
  if (currentRole.value === 'admin' && member.user_id === currentUser.value?.id) {
    return true // Show for self but will be disabled
  }
  return false
}

const getMemberActions = (member: any) => {
  const actions = []
  
  // Edit member action
  actions.push({
    label: 'Edit Member',
    icon: 'i-lucide-edit',
    onSelect: () => handleEditMember(member)
  })
  
  // Remove member action (only if user can manage this member)
  if (canManageMember(member)) {
    actions.push({
      label: 'Remove from Team',
      icon: 'i-lucide-trash-2',
      onSelect: () => handleRemoveMember(member)
    })
  }
  
  return actions
}

// Initialize form with current team data
const initializeForm = () => {
  if (currentTeam.value) {
    // Copy all team data to form
    Object.keys(form).forEach(key => {
      const formKey = key as keyof typeof form
      form[formKey] = currentTeam.value[formKey] || ''
    })
    originalForm.value = { ...form }
  }
}

// Load team members (placeholder - would need API endpoint)
const loadTeamMembers = async () => {
  try {
    // TODO: Implement API call to get team members
    // For now, show current user with real data
    const currentUserProfile = currentUser.value?.user_metadata?.name || currentUser.value?.email?.split('@')[0] || 'User'
    
    teamMembers.value = [
      {
        id: '1',
        user_id: currentUser.value?.id,
        role: currentRole.value || 'member',
        user: { email: currentUser.value?.email },
        profile: { full_name: currentUserProfile }
      }
    ]
  } catch (error) {
    console.error('Failed to load team members:', error)
  }
}

// Form submission
const handleSubmit = async () => {
  try {
    isTeamLoading.value = true
    message.value = null
    
    // For now, only handle team name changes
    // TODO: Implement full team update with company info
    if (form.name !== originalForm.value.name) {
      await renameTeam(form.name)
    }
    
    originalForm.value = { ...form }
    message.value = { type: 'success', text: 'Team updated successfully!' }
    emit('saved', form)
  } catch (error: any) {
    console.error('Team update error:', error)
    message.value = { 
      type: 'error', 
      text: error.message || 'Failed to update team. Please try again.' 
    }
    emit('error', error.message)
  } finally {
    isTeamLoading.value = false
  }
}

// Invite member
const handleInviteMember = async () => {
  try {
    isInviteLoading.value = true
    message.value = null
    
    await inviteMember(inviteEmail.value, inviteRole.value)
    
    message.value = { type: 'success', text: `Invitation sent to ${inviteEmail.value}` }
    inviteEmail.value = ''
    inviteRole.value = 'member'
    showInviteModal.value = false
    
    // Reload team members
    await loadTeamMembers()
  } catch (error: any) {
    console.error('Invite member error:', error)
    message.value = { 
      type: 'error', 
      text: error.message || 'Failed to send invitation. Please try again.' 
    }
  } finally {
    isInviteLoading.value = false
  }
}

// Handle role changes via dropdown
const handleRoleChange = async (member: any, newRole: string) => {
  if (!member || !newRole || member.role === newRole) return
  
  // Check if user can actually change this role
  if (!canChangeRole(member)) {
    message.value = { 
      type: 'error', 
      text: 'You do not have permission to change this member\'s role.' 
    }
    return
  }
  
  // Prevent users from changing their own role to owner (business logic)
  if (member.user_id === currentUser.value?.id && newRole === 'owner') {
    message.value = { 
      type: 'error', 
      text: 'You cannot change your own role to owner.' 
    }
    return
  }
  
  try {
    console.log(`Changing ${member.user?.email} from ${member.role} to ${newRole}`)
    // TODO: Implement API call to update member role
    
    // Update local state for immediate UI feedback
    const oldRole = member.role
    member.role = newRole
    
    message.value = { 
      type: 'success', 
      text: `Successfully updated ${member.user?.email} to ${formatRole(newRole)}` 
    }
  } catch (error: any) {
    console.error('Role change error:', error)
    message.value = { 
      type: 'error', 
      text: error.message || 'Failed to update member role. Please try again.' 
    }
  }
}

// Handle member editing (placeholder)
const handleEditMember = async (member: any) => {
  console.log('Edit member:', member)
  // TODO: Implement member editing functionality (e.g., open edit modal)
}

// Handle member removal (placeholder)
const handleRemoveMember = async (member: any) => {
  console.log('Remove member:', member)
  // TODO: Implement member removal functionality
}


// Watch for team changes
watch(() => currentTeam.value, () => {
  initializeForm()
  loadTeamMembers()
}, { immediate: true })

// Initialize on mount
onMounted(() => {
  if (currentTeam.value) {
    initializeForm()
    loadTeamMembers()
  }
})
</script>
<template>
  <FormDialog
    v-model="isOpen"
    title="Team Members"
    subtitle="Manage your team members and their roles"
    :loading="isDeletingMember"
    @close="handleClose"
  >
    <template #actions>
      <UButton
        v-if="canInviteMembers"
        icon="i-lucide-user-plus"
        :disabled="isInviteLoading"
        @click="showInviteModal = true"
      >
        Invite Member
      </UButton>
    </template>

    <!-- Pending Invitations Section -->
    <UCard
      v-if="pendingInvitations && pendingInvitations.length > 0"
      variant="subtle"
      :ui="{ body: 'p-0 sm:p-0' }"
      class="mb-6"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Pending Invitations
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ pendingInvitations?.length || 0 }} invitation{{ pendingInvitations?.length === 1 ? '' : 's' }} waiting for response
            </p>
          </div>
        </div>
      </template>

      <ul
        role="list"
        class="divide-y divide-default"
      >
        <li
          v-for="invitation in pendingInvitations"
          :key="invitation.id"
          class="flex items-center justify-between gap-3 px-4 sm:px-6"
          style="padding-top: 1rem; padding-bottom: 1rem;"
        >
          <!-- Invitation Info -->
          <div class="flex items-center gap-3 min-w-0">
            <UAvatar
              size="md"
              :ui="{ background: 'bg-orange-100 dark:bg-orange-900' }"
            >
              <UIcon
                name="i-lucide-mail"
                class="text-orange-600 dark:text-orange-400"
              />
            </UAvatar>

            <div class="text-sm min-w-0">
              <p class="text-highlighted font-medium truncate">
                {{ invitation.email }}
              </p>
              <p class="text-muted text-xs">
                Invited by {{ invitation.invited_by }} • {{ formatInviteDate(invitation.invited_at) }}
              </p>
            </div>
          </div>

          <!-- Role and Actions -->
          <div class="flex items-center gap-3">
            <RoleBadge
              :role="invitation.role"
              variant="soft"
              size="lg"
              pending
            />

            <UButton
              icon="i-lucide-x"
              color="red"
              variant="ghost"
              size="sm"
              :loading="revokingInviteIds.has(invitation.id)"
              @click="handleRevokeInvitation(invitation)"
            >
              Revoke
            </UButton>
          </div>
        </li>
      </ul>
    </UCard>

    <!-- Team Members List -->
    <UCard
      variant="subtle"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <ul
        v-if="teamMembers.length > 0"
        role="list"
        class="divide-y divide-default"
      >
        <li
          v-for="member in teamMembers"
          :key="member.id"
          class="flex items-center justify-between gap-3 px-4 sm:px-6"
          style="padding-top: 1rem; padding-bottom: 1rem;"
        >
          <!-- Member Info -->
          <div class="flex items-center gap-3 min-w-0">
            <UAvatar size="md">
              {{ getMemberInitials(member) }}
            </UAvatar>

            <div class="text-sm min-w-0">
              <p class="text-highlighted font-medium truncate">
                {{ member.profile?.full_name || 'Unknown User' }}
                <span
                  v-if="member.user_id === currentUser?.id"
                  class="text-muted font-normal"
                > (me)</span>
              </p>
              <p
                v-if="member.profile?.email"
                class="text-muted truncate"
              >
                {{ member.profile.email }}
              </p>
            </div>
          </div>

          <!-- Role and Actions -->
          <div class="flex items-center gap-3">
            <USelect
              v-if="canChangeRole(member)"
              :model-value="member.role"
              :items="getAvailableRoleOptions(member)"
              color="neutral"
              :ui="{ value: 'capitalize', item: 'capitalize' }"
              @update:model-value="(newRole: string) => handleRoleChange(member, newRole)"
            />
            <RoleBadge
              v-else
              :role="member.role"
            />

            <UDropdownMenu
              :items="getMemberActions(member)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
              />
            </UDropdownMenu>
          </div>
        </li>
      </ul>

      <!-- Empty State -->
      <div
        v-else
        class="text-center py-12"
      >
        <UIcon
          name="i-lucide-users"
          class="mx-auto h-12 w-12 text-gray-400 mb-4"
        />
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
  </FormDialog>

  <!-- Invite Member Modal -->
  <ActionDialog
    v-model="showInviteModal"
    title="Invite Team Member"
    subtitle="Send an invitation to join your team"
    :loading="isInviteLoading"
    :is-valid="!!inviteEmail && !!inviteRole"
    action-text="Send Invitation"
    cancel-text="Cancel"
    @action="handleInviteMember"
    @close="handleInviteModalClose"
  >
    <UFormField
      label="Email Address"
      required
      class="mb-4"
    >
      <UInput
        v-model="inviteEmail"
        type="email"
        placeholder="member@company.com"
        :disabled="isInviteLoading"
        size="md"
      />
    </UFormField>

    <UFormField
      label="Role"
      class="mb-4"
    >
      <USelect
        v-model="inviteRole"
        :items="getInviteRoleOptions"
        :disabled="isInviteLoading"
        size="md"
      />
    </UFormField>
  </ActionDialog>

  <!-- Confirmation Modal for Member Deletion -->
  <ConfirmDialog
    v-model="showConfirmModal"
    title="Delete Team Member"
    :message="`Are you sure you want to delete ${memberToDelete?.profile?.full_name || memberToDelete?.profile?.email || 'this member'}? This will permanently delete their account and all associated data. This action cannot be undone.`"
    cancel-text="Cancel"
    confirm-text="Delete Member"
    confirm-color="red"
    :loading="isDeletingMember"
    @confirm="confirmDeleteMember"
    @cancel="cancelDeleteMember"
  />

  <!-- Edit User Modal -->
  <EditUserModal
    v-if="showEditUserModal"
    v-model:open="showEditUserModal"
    :user-id="editingUserId"
    @saved="handleUserSaved"
    @close="handleEditUserModalClose"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import type { Profile } from '../types'
import ConfirmDialog from './ConfirmDialog.vue'
import EditUserModal from './EditUserModal.vue'
import FormDialog from './FormDialog.vue'
import RoleBadge from './RoleBadge.vue'
import { useToast } from '#imports'

// Team member with profile data
interface TeamMemberWithProfile {
  user_id: string
  role: string
  joined_at: string
  profile?: Profile
  id?: string // Computed from user_id
  full_name?: string
  email?: string
}

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [data: TeamMemberWithProfile]
  'error': [error: string]
}>()

// Get auth state and composable functions
const { currentUser, currentRole, currentTeam, teamMembers, inviteMember, getAvatarFallback, getTeamMembers, updateMemberRole, removeMember, revokeInvite, getPendingInvitations } = useTeamAuth()

// Watch modelValue changes
watch(() => props.modelValue, () => {
  // Modal state changed
}, { immediate: true })

// Component state
const isInviteLoading = ref(false)
const isDeletingMember = ref(false)
const revokingInviteIds = ref<Set<string>>(new Set())
const showInviteModal = ref(false)
const showConfirmModal = ref(false)
const memberToDelete = ref<TeamMemberWithProfile | null>(null)
const showEditUserModal = ref(false)
const editingUserId = ref<string | null>(null)

// Invite state
const inviteEmail = ref('')
const inviteRole = ref('member')

// Back to manual fetch with reactive data - avoiding useLazyFetch SSR issues
const pendingInvitations = ref([])
const pendingInvitationsLoading = ref(false)
const pendingInvitationsError = ref(null)

const refreshPendingInvitations = async () => {
  // Only fetch if we have authentication and team
  if (!currentTeam.value?.id || !currentUser.value) return

  // Only fetch if user has permission to view invitations
  if (!['owner', 'admin', 'super_admin'].includes(currentRole.value)) return

  try {
    pendingInvitationsLoading.value = true
    pendingInvitationsError.value = null

    const invitations = await getPendingInvitations()
    pendingInvitations.value = invitations || []
  }
  catch (error: any) {
    console.error('Failed to fetch pending invitations:', error)
    pendingInvitationsError.value = error
    pendingInvitations.value = []
  }
  finally {
    pendingInvitationsLoading.value = false
  }
}

// Watch for auth and team changes
watch([currentTeam, currentUser], () => {
  if (currentTeam.value?.id && currentUser.value) {
    refreshPendingInvitations()
  }
}, { immediate: false, deep: false })

// Manual refresh when dialog opens
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && currentTeam.value?.id) {
    // Use nextTick to ensure the component is fully rendered before loading data
    await nextTick()
    loadTeamMembers()
    refreshPendingInvitations()
  }
})

// Toast notifications
const toast = useToast()

// Computed properties
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const canInviteMembers = computed(() => {
  return ['admin', 'owner', 'super_admin'].includes(currentRole.value || '')
})

// Get available role options for a specific member based on current user's role and RLS restrictions
const getAvailableRoleOptions = (member: TeamMemberWithProfile) => {
  if (!canChangeRole(member)) {
    return []
  }

  const baseOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ]

  // Super admins can assign any role except super_admin
  if (currentRole.value === 'super_admin') {
    return [
      ...baseOptions,
      { label: 'Owner', value: 'owner' },
    ]
  }

  // Owners can assign any role except super_admin (RLS line 66)
  if (currentRole.value === 'owner') {
    return [
      ...baseOptions,
      { label: 'Owner', value: 'owner' },
    ]
  }

  // Admins can only assign 'member' or 'admin' roles (RLS line 62)
  // AND can only modify users who are currently 'member' (RLS line 63)
  if (currentRole.value === 'admin' && member.role === 'member') {
    return baseOptions // member, admin only
  }

  return []
}

// Get available role options for inviting new members (RLS INSERT restrictions)
const getInviteRoleOptions = computed(() => {
  // Super admins can invite with any role except super_admin
  if (currentRole.value === 'super_admin') {
    return [
      { label: 'Member', value: 'member' },
      { label: 'Admin', value: 'admin' },
      { label: 'Owner', value: 'owner' },
    ]
  }

  // Owners can invite members or admins (RLS line 40)
  if (currentRole.value === 'owner') {
    return [
      { label: 'Member', value: 'member' },
      { label: 'Admin', value: 'admin' },
    ]
  }

  // Admins can invite members or admins (consistent with their UPDATE permissions)
  if (currentRole.value === 'admin') {
    return [
      { label: 'Member', value: 'member' },
      { label: 'Admin', value: 'admin' },
    ]
  }

  return []
})

// Helper functions
const formatRole = (role: string | null | undefined) => {
  if (!role) return 'Unknown'
  if (role === 'super_admin') return 'Super Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const getMemberInitials = (member: TeamMemberWithProfile) => {
  return getAvatarFallback({
    fullName: member.profile?.full_name,
    email: member.user?.email,
  })
}

const canManageMember = (member: TeamMemberWithProfile) => {
  // Cannot manage yourself (RLS restriction: user_id != auth.uid())
  if (member.user_id === currentUser.value?.id) {
    return false
  }

  // Super admins can manage anyone except super_admins
  if (currentRole.value === 'super_admin') {
    return member.role !== 'super_admin'
  }

  // Owners can manage anyone except super_admins and themselves (RLS line 87)
  if (currentRole.value === 'owner') {
    return member.role !== 'super_admin'
  }

  // Admins can only manage users with 'member' role (RLS line 85)
  if (currentRole.value === 'admin') {
    return member.role === 'member'
  }

  // Members cannot manage anyone
  return false
}

const canChangeRole = (member: TeamMemberWithProfile) => {
  // Users cannot change their own role (RLS restriction: user_id != auth.uid())
  if (member.user_id === currentUser.value?.id) {
    return false
  }

  // Super admins can modify anyone except super admins
  if (currentRole.value === 'super_admin') {
    return member.role !== 'super_admin'
  }

  // Owners can modify anyone except super admins and themselves
  if (currentRole.value === 'owner') {
    return member.role !== 'super_admin'
  }

  // Admins can ONLY modify users who are currently 'member' (RLS line 63)
  if (currentRole.value === 'admin') {
    return member.role === 'member'
  }

  // Members cannot change any roles
  return false
}

const getMemberActions = (member: any) => {
  const actions = []
  const isCurrentUser = member.user_id === currentUser.value?.id
  const canDelete = canManageMember(member)

  // Edit member action
  actions.push({
    label: 'Edit Member',
    icon: 'i-lucide-edit',
    onSelect: () => handleEditMember(member),
  })

  // Delete user action (always show, but disable for current user)
  actions.push({
    label: 'Delete Member',
    icon: 'i-lucide-trash-2',
    disabled: isCurrentUser || !canDelete,
    onSelect: () => handleRemoveMember(member),
  })

  return actions
}

// Load team members using composable
const loadTeamMembers = async () => {
  try {
    await getTeamMembers()
  }
  catch (error) {
    console.error('Failed to load team members:', error)
  }
}

// Invite member
const handleInviteMember = async () => {
  try {
    isInviteLoading.value = true

    // Client-side validation: check if user is already a member of this team
    const existingMember = teamMembers.value.find(
      member => member.profile?.email?.toLowerCase() === inviteEmail.value.toLowerCase(),
    )

    if (existingMember) {
      toast.add({
        title: 'User Already a Member',
        description: `${inviteEmail.value} is already a member of this team.`,
        color: 'red',
      })
      return
    }

    // Client-side validation: check if user has a pending invitation
    const existingInvite = pendingInvitations.value.find(
      invite => invite.email?.toLowerCase() === inviteEmail.value.toLowerCase(),
    )

    if (existingInvite) {
      toast.add({
        title: 'Invitation Already Sent',
        description: `${inviteEmail.value} already has a pending invitation.`,
        color: 'red',
      })
      return
    }

    await inviteMember(inviteEmail.value, inviteRole.value)

    toast.add({
      title: 'Invitation Sent',
      description: `Invitation sent to ${inviteEmail.value}`,
      color: 'green',
    })

    inviteEmail.value = ''
    inviteRole.value = 'member'
    showInviteModal.value = false

    // Reload team members and pending invitations
    await loadTeamMembers()
    await refreshPendingInvitations()
  }
  catch (error: any) {
    console.error('Invite member error:', error)
    toast.add({
      title: 'Invitation Failed',
      description: error.message || 'Failed to send invitation. Please try again.',
      color: 'red',
    })
  }
  finally {
    isInviteLoading.value = false
  }
}

// Handle invite modal close
const handleInviteModalClose = () => {
  // Reset form if needed
  if (inviteEmail.value || inviteRole.value !== 'member') {
    inviteEmail.value = ''
    inviteRole.value = 'member'
  }
}

// Handle role changes via dropdown
const handleRoleChange = async (member: any, newRole: string) => {
  if (!member || !newRole || member.role === newRole) return

  // Check if user can actually change this role
  if (!canChangeRole(member)) {
    toast.add({
      title: 'Permission Denied',
      description: 'You do not have permission to change this member\'s role.',
      color: 'red',
    })
    return
  }

  // Defensive check: prevent users from changing their own role (should be prevented by UI)
  if (member.user_id === currentUser.value?.id) {
    toast.add({
      title: 'Invalid Action',
      description: 'You cannot change your own role.',
      color: 'red',
    })
    return
  }

  try {
    // Update role in database using composable
    await updateMemberRole(member.user_id, newRole)

    // Show success toast
    toast.add({
      title: 'Role Updated',
      description: `${member.profile?.full_name || member.profile?.email} is now ${formatRole(newRole).toLowerCase()}`,
      color: 'green',
    })
  }
  catch (error: any) {
    console.error('Role change error:', error)
    toast.add({
      title: 'Update Failed',
      description: error.message || 'Failed to update member role. Please try again.',
      color: 'red',
    })
  }
}

// Handle member editing
const handleEditMember = async (member: any) => {
  editingUserId.value = member.user_id
  showEditUserModal.value = true
}

// Handle edit user modal close
const handleEditUserModalClose = () => {
  showEditUserModal.value = false
  editingUserId.value = null
}

// Handle user saved from edit modal
const handleUserSaved = (_profile: Profile) => {
  // Find the member to get their name for the toast
  const member = teamMembers.value.find(m => m.user_id === editingUserId.value)
  const memberName = member?.profile?.full_name || member?.profile?.email || 'User'

  toast.add({
    title: 'Member Updated',
    description: `${memberName}'s profile has been updated successfully.`,
    color: 'green',
  })

  // The modal will close automatically
  // The reactive state is already updated by the composable
}

// Handle member removal - show confirmation modal
const handleRemoveMember = async (member: any) => {
  memberToDelete.value = member
  showConfirmModal.value = true
}

// Confirm member deletion
const confirmDeleteMember = async () => {
  if (!memberToDelete.value) return

  try {
    isDeletingMember.value = true

    await removeMember(memberToDelete.value.user_id)

    toast.add({
      title: 'Member Removed',
      description: `${memberToDelete.value.profile?.full_name || memberToDelete.value.profile?.email} has been removed from the team.`,
      color: 'green',
    })
  }
  catch (error: any) {
    console.error('Remove member error:', error)
    toast.add({
      title: 'Remove Failed',
      description: error.message || 'Failed to remove member. Please try again.',
      color: 'red',
    })
  }
  finally {
    isDeletingMember.value = false
    showConfirmModal.value = false
    memberToDelete.value = null
  }
}

// Cancel member deletion
const cancelDeleteMember = () => {
  showConfirmModal.value = false
  memberToDelete.value = null
}

// Handle revoking an invitation
const handleRevokeInvitation = async (invitation: any) => {
  try {
    revokingInviteIds.value.add(invitation.id)

    await revokeInvite(invitation.id)

    toast.add({
      title: 'Invitation Revoked',
      description: `Invitation for ${invitation.email} has been revoked`,
      color: 'green',
    })

    // Reload pending invitations
    await refreshPendingInvitations()
  }
  catch (error: any) {
    console.error('Revoke invitation error:', error)

    // Extract a clean error message
    let errorMessage = 'Failed to revoke invitation. Please try again.'

    // Handle FetchError specifically
    if (error.data && typeof error.data === 'string') {
      // Extract message from FetchError format
      errorMessage = error.data
    }
    else if (error.statusMessage) {
      errorMessage = error.statusMessage
    }
    else if (error.message) {
      // Clean up technical error messages
      const match = error.message.match(/: (\d{3}) (.+)$/)
      if (match) {
        errorMessage = match[2] // Extract just the message part after status code
      }
      else {
        errorMessage = error.message
      }
    }

    toast.add({
      title: 'Revoke Failed',
      description: errorMessage,
      color: 'red',
    })
  }
  finally {
    revokingInviteIds.value.delete(invitation.id)
  }
}

// Format invitation date
const formatInviteDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) {
    return 'Just now'
  }
  else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }
  else {
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }
}

// Handle close
const handleClose = () => {
  // Could add cleanup here if needed
}

// Initialize on mount
onMounted(() => {
  // Don't load data on mount - wait for dialog to open via watch
})
</script>

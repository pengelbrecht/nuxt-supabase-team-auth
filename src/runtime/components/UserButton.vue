<template>
  <div>
    <UDropdownMenu
      :items="dropdownItems"
      :content="{ align: 'end' }"
    >
      <UButton
        variant="ghost"
        class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        :aria-label="currentUser ? `User menu for ${currentProfile?.full_name || currentUser.user_metadata?.name || currentUser.email}` : 'User menu'"
        :aria-expanded="false"
      >
        <!-- Show name if requested -->
        <span
          v-if="props.showName && currentUser"
          class="mr-3 text-sm font-medium !text-gray-700 dark:!text-gray-300"
          style="color: rgb(55, 65, 81) !important;"
        >
          {{ currentProfile?.full_name || currentUser.user_metadata?.name || currentUser.email }}
        </span>

        <UAvatar
          :src="currentUser?.user_metadata?.avatar_url || undefined"
          :alt="currentProfile?.full_name || currentUser?.user_metadata?.name || currentUser?.email || 'User'"
          :size="props.size"
          :icon="!currentUser ? 'i-lucide-user' : undefined"
          class="ring-2 ring-white dark:ring-gray-900"
        >
          {{ avatarFallback }}
        </UAvatar>
      </UButton>
    </UDropdownMenu>

    <!-- Settings Modal -->
    <SettingsModal
      v-model="showSettingsModal"
      :tab="settingsTab"
      @saved="handleSettingsSaved"
      @error="handleSettingsError"
    />

    <!-- Company Settings Dialog -->
    <CompanySettingsDialog
      v-model="showCompanySettingsDialog"
      @saved="handleCompanySettingsSaved"
      @error="handleSettingsError"
    />

    <!-- Team Members Dialog -->
    <TeamMembersDialog
      v-model="showTeamMembersDialog"
      @saved="handleTeamMembersSaved"
      @error="handleSettingsError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import SettingsModal from './SettingsModal.vue'
import CompanySettingsDialog from './CompanySettingsDialog.vue'
import TeamMembersDialog from './TeamMembersDialog.vue'

// Props
interface Props {
  /** Custom avatar size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show user name next to avatar */
  showName?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showName: false,
})

// Get unified auth state including impersonation
const {
  currentUser,
  currentProfile,
  currentRole,
  signOut,
  isImpersonating,
  getAvatarFallback,
  justStartedImpersonation,
  clearSuccessFlag,
  stopImpersonation,
} = useTeamAuth()

// Modal state
const showSettingsModal = ref(false)
const settingsTab = ref<'profile' | 'impersonation'>('profile')
const showCompanySettingsDialog = ref(false)
const showTeamMembersDialog = ref(false)

// Computed properties
const avatarFallback = computed(() => {
  if (!currentUser.value) return ''

  // Use shared avatar fallback logic with profile data
  const profileFullName = currentProfile.value?.full_name
  return getAvatarFallback({
    fullName: profileFullName,
    email: undefined, // Let it use currentUser.email
  })
})

const isAdmin = computed(() => {
  return currentRole.value === 'admin' || currentRole.value === 'owner'
})

const isSuperAdmin = computed(() => {
  return currentRole.value === 'super_admin'
})

// Modal handlers
const openProfileSettings = () => {
  settingsTab.value = 'profile'
  showSettingsModal.value = true
}

const openCompanySettings = () => {
  showCompanySettingsDialog.value = true
}

const openTeamMembers = () => {
  showTeamMembersDialog.value = true
}

const openImpersonationSettings = () => {
  settingsTab.value = 'impersonation'
  showSettingsModal.value = true
}

const handleSettingsSaved = (_data: any) => {
  // Profile updates automatically via reactive state in composable
}

const handleCompanySettingsSaved = (_data: any) => {
  // Company updates automatically via reactive state in composable
}

const handleTeamMembersSaved = (_data: any) => {
  // Team member updates automatically via reactive state in composable
}

const handleSettingsError = (error: string) => {
  console.error('Settings error:', error)
  // Handle error display
}

// Dropdown menu items for Nuxt UI v3
const dropdownItems = computed(() => {
  if (!currentUser.value) {
    return [
      {
        label: 'Not signed in',
        disabled: true,
      },
    ]
  }

  const items = []

  // Only show user info header if name is NOT already shown next to button
  if (!props.showName) {
    items.push({
      label: currentProfile.value?.full_name || currentUser.value.user_metadata?.name || currentUser.value.email || 'User',
      icon: 'i-lucide-user-circle',
      type: 'label',
      disabled: true,
    })

    // Separator
    items.push({
      type: 'separator',
    })
  }

  // Main actions
  items.push({
    label: 'User Settings',
    icon: 'i-lucide-user',
    onSelect: () => {
      openProfileSettings()
    },
  })

  // Company management (admin/owner + super_admin only)
  if (isAdmin.value || isSuperAdmin.value) {
    items.push({
      label: 'Company Settings',
      icon: 'i-lucide-building',
      onSelect: () => {
        openCompanySettings()
      },
    })

    items.push({
      label: 'Team Members',
      icon: 'i-lucide-users',
      onSelect: () => {
        openTeamMembers()
      },
    })
  }

  // Impersonation section (super admin only)
  if (isSuperAdmin.value) {
    items.push({
      type: 'separator',
    })

    if (isImpersonating.value) {
      items.push({
        label: 'Stop Impersonation',
        icon: 'i-lucide-arrow-left',
        onSelect: () => {
          stopImpersonation()
        },
      })
    }
    else {
      items.push({
        label: 'Start Impersonation',
        icon: 'i-lucide-arrow-right',
        onSelect: () => {
          openImpersonationSettings()
        },
      })
    }
  }

  // Separator before sign out
  items.push({
    type: 'separator',
  })

  // Sign out
  items.push({
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      try {
        await signOut()
        // Redirect to home page after sign out
        await navigateTo('/')
      }
      catch (error) {
        throw error
      }
    },
  })

  return items
})

// Watch for successful impersonation to close modal
watch(justStartedImpersonation, (newValue, _oldValue) => {
  if (newValue) {
    showSettingsModal.value = false
    clearSuccessFlag()
  }
})
</script>

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

        <ClientOnly>
          <UAvatar
            :src="currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url || undefined"
            :alt="currentProfile?.full_name || currentUser?.user_metadata?.name || currentUser?.email || 'User'"
            :size="props.size"
            :icon="!currentUser ? 'i-lucide-user' : undefined"
            class="ring-2 ring-white dark:ring-gray-900"
          >
            {{ avatarFallback }}
          </UAvatar>
          <template #fallback>
            <UAvatar
              :size="props.size"
              icon="i-lucide-user"
              class="ring-2 ring-white dark:ring-gray-900"
            />
          </template>
        </ClientOnly>
      </UButton>
    </UDropdownMenu>

    <!-- Profile Settings Dialog -->
    <FormDialog
      v-model="showProfileDialog"
      title="Edit Profile"
      subtitle="Manage your personal profile information and account settings"
      :has-changes="profileHasChanges"
      :loading="profileLoading"
      save-text="Save Changes"
      @save="handleProfileSave"
      @close="handleProfileClose"
      @cancel="handleProfileCancel"
    >
      <UserProfileForm
        ref="profileFormRef"
        :is-modal="true"
        @saved="handleProfileSaved"
        @error="handleSettingsError"
      />
    </FormDialog>

    <!-- Impersonation Dialog -->
    <DialogBox
      v-model="showImpersonationDialog"
      title="Start Impersonation"
      subtitle="Select a user to impersonate for support and debugging purposes"
    >
      <SuperAdminImpersonationContent />
    </DialogBox>

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
import CompanySettingsDialog from './CompanySettingsDialog.vue'
import TeamMembersDialog from './TeamMembersDialog.vue'
import UserProfileForm from './UserProfileForm.vue'
import SuperAdminImpersonationContent from './SuperAdminImpersonationContent.vue'
import { navigateTo } from '#imports'

// Custom menu item interface
interface CustomMenuItem {
  /** Display text for the menu item */
  label: string
  /** Icon name (e.g., 'i-lucide-settings') */
  icon?: string
  /** Internal route to navigate to */
  to?: string
  /** External URL to navigate to */
  href?: string
  /** Link target (e.g., '_blank') */
  target?: string
  /** Custom click handler (overrides navigation) */
  onSelect?: (event: Event) => void
  /** Disable the menu item */
  disabled?: boolean
  /** Required role to show this item */
  requiredRole?: 'member' | 'admin' | 'owner' | 'super_admin'
  /** Add a separator after this item */
  addSeparator?: boolean
}

// Props
interface Props {
  /** Custom avatar size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show user name next to avatar */
  showName?: boolean
  /** Custom menu items to add to the dropdown */
  customItems?: CustomMenuItem[]
  /** Where to insert custom items in the menu */
  customItemsPosition?: 'after-user-info' | 'after-main-actions' | 'before-signout'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showName: false,
  customItems: () => [],
  customItemsPosition: 'before-signout',
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
const showProfileDialog = ref(false)
const showImpersonationDialog = ref(false)
const showCompanySettingsDialog = ref(false)
const showTeamMembersDialog = ref(false)
const profileFormRef = ref<InstanceType<typeof UserProfileForm> | null>(null)
const profileLoading = ref(false)

// Computed properties - ensure consistent SSR/client rendering
const avatarFallback = computed(() => {
  // During SSR, currentUser may be null, so return empty string consistently
  if (!currentUser.value) return ''

  // Use shared avatar fallback logic with profile data
  const profileFullName = currentProfile.value?.full_name
  return getAvatarFallback({
    fullName: profileFullName,
    email: undefined, // Let it use currentUser.email
  })
})

// Role hierarchy checks
const hasAdminPrivileges = computed(() => {
  return currentRole.value === 'admin' || currentRole.value === 'owner' || currentRole.value === 'super_admin'
})

const isOwner = computed(() => {
  return currentRole.value === 'owner'
})

const isSuperAdmin = computed(() => {
  return currentRole.value === 'super_admin'
})

const profileHasChanges = computed(() => {
  return profileFormRef.value?.hasChanges || false
})

// Modal handlers
const openProfileSettings = () => {
  showProfileDialog.value = true
}

const openCompanySettings = () => {
  showCompanySettingsDialog.value = true
}

const openTeamMembers = () => {
  showTeamMembersDialog.value = true
}

const openImpersonationSettings = () => {
  showImpersonationDialog.value = true
}

const handleProfileSave = async () => {
  if (!profileFormRef.value) return

  try {
    profileLoading.value = true
    await profileFormRef.value.handleSubmit()
  }
  catch (error: any) {
    console.error('Profile save failed:', error)
  }
  finally {
    profileLoading.value = false
  }
}

const handleProfileClose = () => {
  // Form will handle resetting if needed
}

const handleProfileCancel = () => {
  // Reset form to original values and close
  if (profileFormRef.value) {
    // Form will handle resetting itself
  }
}

const handleProfileSaved = (_data: any) => {
  // Profile updates automatically via reactive state in composable
  showProfileDialog.value = false
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

// Helper function to process custom menu items
const processCustomItems = (customItems: CustomMenuItem[]) => {
  return customItems
    .filter((item) => {
      // Filter by required role if specified
      if (!item.requiredRole) return true

      switch (item.requiredRole) {
        case 'super_admin':
          return isSuperAdmin.value
        case 'owner':
          return isOwner.value || isSuperAdmin.value
        case 'admin':
          return hasAdminPrivileges.value
        case 'member':
        default:
          return currentUser.value !== null
      }
    })
    .map((item) => {
      const processedItem: any = {
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
      }

      // Handle navigation vs custom action
      if (item.onSelect) {
        processedItem.onSelect = item.onSelect
      }
      else if (item.to) {
        processedItem.onSelect = () => navigateTo(item.to!)
      }
      else if (item.href) {
        processedItem.onSelect = () => {
          window.open(item.href!, item.target || '_self')
        }
      }

      return processedItem
    })
}

// Helper function to add custom items with proper separator handling
const addCustomItemsWithSeparators = (items: any[], customItems: CustomMenuItem[]) => {
  const processedItems = processCustomItems(customItems)

  if (processedItems.length === 0) return false

  processedItems.forEach((item) => {
    items.push(item)

    // Add separator only if specifically requested for this item
    const originalCustomItem = customItems.find(ci => ci.label === item.label)
    if (originalCustomItem?.addSeparator) {
      items.push({ type: 'separator' })
    }
  })

  return true
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

  // Insert custom items after user info
  if (props.customItemsPosition === 'after-user-info' && props.customItems?.length) {
    addCustomItemsWithSeparators(items, props.customItems)
  }

  // Main actions
  items.push({
    label: 'User Settings',
    icon: 'i-lucide-user',
    onSelect: () => {
      openProfileSettings()
    },
  })

  // Company management (admin/owner/super_admin only)
  if (hasAdminPrivileges.value) {
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

  // Insert custom items after main actions
  if (props.customItemsPosition === 'after-main-actions' && props.customItems?.length) {
    addCustomItemsWithSeparators(items, props.customItems)
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

  // Insert custom items before sign out (default position)
  if (props.customItemsPosition === 'before-signout' && props.customItems?.length) {
    // Only add separator if we haven't already added one from impersonation section
    if (!isSuperAdmin.value) {
      items.push({
        type: 'separator',
      })
    }
    addCustomItemsWithSeparators(items, props.customItems)
  }
  else {
    // Add separator before sign out if no custom items added here
    items.push({
      type: 'separator',
    })
  }

  // Sign out
  items.push({
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      await signOut()
      // Redirect to home page after sign out
      await navigateTo('/')
    },
  })

  return items
})

// Watch for successful impersonation to close modal
watch(justStartedImpersonation, (newValue, _oldValue) => {
  if (newValue) {
    showImpersonationDialog.value = false
    clearSuccessFlag()
  }
})
</script>

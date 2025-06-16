<template>
  <UDropdownMenu :items="dropdownItems" :content="{ align: 'end' }">
    <UButton 
      variant="ghost" 
      class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
    >
      <UAvatar
        :src="currentUser?.user_metadata?.avatar_url || currentUser?.avatar_url || undefined"
        :alt="currentUser?.user_metadata?.full_name || currentUser?.full_name || currentUser?.email || 'User'"
        :size="props.size"
        :icon="!currentUser ? 'i-lucide-user' : undefined"
        class="ring-2 ring-white dark:ring-gray-900"
      >
        {{ avatarFallback }}
      </UAvatar>
      
      <!-- Show name if requested -->
      <span v-if="props.showName && currentUser" class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ currentUser.user_metadata?.full_name || currentUser.full_name || currentUser.email }}
      </span>
    </UButton>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'

// Props
interface Props {
  /** Custom avatar size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show user name next to avatar */
  showName?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  showName: false
})

// Emits
const emit = defineEmits<{
  profile: []
  teamSettings: []
  impersonation: []
}>()

// Get auth state
const { currentUser, currentRole, signOut, isImpersonating, stopImpersonation } = useTeamAuth()

// Computed properties
const avatarFallback = computed(() => {
  if (!currentUser.value) return ''
  
  // Try different paths for user data (user_metadata takes priority)
  const fullName = currentUser.value.user_metadata?.full_name || currentUser.value.full_name
  const email = currentUser.value.email
  
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

const isAdmin = computed(() => {
  return currentRole.value === 'admin' || currentRole.value === 'owner'
})

const isSuperAdmin = computed(() => {
  return currentRole.value === 'super_admin'
})

// Dropdown menu items for Nuxt UI v3
const dropdownItems = computed(() => {
  if (!currentUser.value) {
    return [
      {
        label: 'Not signed in',
        disabled: true
      }
    ]
  }

  const items = []
  
  // User info header
  items.push({
    label: currentUser.value.user_metadata?.full_name || currentUser.value.full_name || currentUser.value.email || 'User',
    icon: 'i-lucide-user-circle',
    type: 'label',
    disabled: true
  })
  
  // Separator
  items.push({
    type: 'separator'
  })
  
  // Main actions
  items.push({
    label: 'Profile & Settings',
    icon: 'i-lucide-user',
    onSelect: () => {
      console.log('Profile clicked')
      emit('profile')
    }
  })
  
  // Team management (admin/owner only)
  if (isAdmin.value) {
    items.push({
      label: 'Team Settings',
      icon: 'i-lucide-users',
      onSelect: () => {
        console.log('Team Settings clicked')
        emit('teamSettings')
      }
    })
  }
  
  // Impersonation section (super admin only)
  if (isSuperAdmin.value) {
    items.push({
      type: 'separator'
    })
    
    if (isImpersonating.value) {
      items.push({
        label: 'Stop Impersonation',
        icon: 'i-lucide-arrow-left',
        onSelect: () => {
          console.log('Stop Impersonation clicked')
          stopImpersonation()
        }
      })
    } else {
      items.push({
        label: 'Start Impersonation',
        icon: 'i-lucide-arrow-right',
        onSelect: () => {
          console.log('Start Impersonation clicked')
          emit('impersonation')
        }
      })
    }
  }
  
  // Separator before sign out
  items.push({
    type: 'separator'
  })
  
  // Sign out
  items.push({
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    onSelect: () => {
      console.log('Sign Out clicked')
      signOut()
    }
  })
  
  return items
})
</script>
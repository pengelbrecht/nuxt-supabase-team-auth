<template>
  <UBadge
    :color="badgeColor"
    :variant="props.variant"
    :size="badgeSize"
  >
    {{ formattedRole }}
  </UBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTeamAuthConfig } from '../composables/useTeamAuthConfig'
import { formatRole, isCustomRole } from '../utils/roles'

// Props
interface Props {
  /** User role */
  role: string | null | undefined
  /** Override size (default: auto-sized based on role) */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Badge variant (default: soft) */
  variant?: 'solid' | 'outline' | 'soft' | 'subtle'
  /** Whether this is a pending invitation */
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: undefined,
  variant: 'soft',
  pending: false,
})

// Computed properties
const { customRoles } = useTeamAuthConfig()

const formattedRole = computed(() => formatRole(props.role, customRoles.value))

const badgeColor = computed(() => {
  // Pending invitations get warning color (orange/amber)
  if (props.pending) return 'warning'

  if (!props.role) return 'neutral'

  // Standard role colors using valid Nuxt UI color names
  switch (props.role) {
    case 'super_admin': return 'primary'
    case 'owner': return 'secondary'
    case 'admin': return 'info'
    case 'member': return 'neutral'
    default: return isCustomRole(props.role, customRoles.value) ? 'success' : 'warning'
  }
})

const badgeSize = computed(() => {
  // Use explicit size if provided, otherwise use consistent default
  return props.size || 'lg'
})
</script>

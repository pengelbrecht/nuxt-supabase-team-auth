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
const formattedRole = computed(() => {
  if (!props.role) return 'Unknown'
  if (props.role === 'super_admin') return 'Super Admin'
  return props.role.charAt(0).toUpperCase() + props.role.slice(1)
})

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
    default: return 'warning'
  }
})

const badgeSize = computed(() => {
  // Use explicit size if provided, otherwise use consistent default
  return props.size || 'lg'
})
</script>

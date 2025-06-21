<template>
  <SettingsTabContainer>
    <UCard class="w-full">
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Start User Impersonation
          </h2>
        </div>
      </template>

      <div class="space-y-8">
        <!-- Search Input -->
        <UFormField
          label="Search Users"
          name="search"
          class="flex items-center justify-between mb-4 gap-2"
        >
          <UInput
            v-model="searchQuery"
            placeholder="Search by name, email, or user ID..."
            icon="i-lucide-search"
            size="md"
            :loading="isSearching"
            @input="handleSearchInput"
          />
        </UFormField>

        <!-- Reason Input -->
        <UFormField
          label="Reason for Impersonation"
          name="reason"
          required
          description="Please provide a business justification for this impersonation session."
          class="flex items-center justify-between mb-4 gap-2"
        >
          <UInput
            v-model="impersonationReason"
            placeholder="e.g., Customer support ticket #12345 - investigating login issues"
            :disabled="isLoading"
            size="md"
          />
        </UFormField>

        <!-- Users List -->
        <UCard
          variant="subtle"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {{ searchQuery ? (searchQuery.length < 3 ? 'Filtered Users' : 'Search Results') : 'All Users' }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select a user to impersonate for support and debugging
                </p>
              </div>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ displayedUsers.length }} user{{ displayedUsers.length !== 1 ? 's' : '' }}
                {{ searchQuery ? (searchQuery.length < 3 ? 'shown' : 'found') : 'total' }}
              </span>
            </div>
          </template>

          <!-- Users List -->
          <ul
            v-if="displayedUsers.length > 0"
            role="list"
            class="divide-y divide-default"
          >
            <li
              v-for="user in displayedUsers"
              :key="user.id"
              class="flex items-center justify-between gap-3 px-4 sm:px-6"
              style="padding-top: 1rem; padding-bottom: 1rem;"
            >
              <!-- User Info -->
              <div class="flex items-center gap-3 min-w-0">
                <UAvatar size="md">
                  {{ getUserInitials(user) }}
                </UAvatar>

                <div class="text-sm min-w-0">
                  <p class="text-highlighted font-medium truncate">
                    {{ user.full_name || 'Unknown User' }}
                    <span
                      v-if="user.id === currentUser?.id"
                      class="text-muted font-normal"
                    > (you)</span>
                  </p>
                  <p class="text-muted truncate">
                    {{ user.email }}
                  </p>
                  <p
                    v-if="user.team_name"
                    class="text-muted text-xs truncate"
                  >
                    Team: {{ user.team_name }}
                  </p>
                </div>
              </div>

              <!-- Role and Actions -->
              <div class="flex items-center gap-3">
                <RoleBadge :role="user.role" />

                <UButton
                  :disabled="user.id === currentUser?.id || !impersonationReason.trim() || isStarting"
                  :loading="isStarting && impersonatingUserId === user.id"
                  size="sm"
                  icon="i-lucide-arrow-right"
                  @click="() => handleStartImpersonation(user.id)"
                >
                  Impersonate
                </UButton>
              </div>
            </li>
          </ul>

          <!-- Empty State -->
          <div
            v-else-if="!isLoadingUsers"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-users"
              class="mx-auto h-12 w-12 text-gray-400 mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {{ searchQuery ? 'No users found' : 'No users available' }}
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
              {{ searchQuery ? 'Try adjusting your search terms.' : 'No users are available for impersonation.' }}
            </p>
          </div>

          <!-- Loading State -->
          <div
            v-else-if="isLoadingUsers"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="mx-auto h-8 w-8 text-gray-400 mb-4 animate-spin"
            />
            <p class="text-gray-600 dark:text-gray-400">
              Loading users...
            </p>
          </div>
        </UCard>
      </div>
    </UCard>
  </SettingsTabContainer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTeamAuth } from '../composables/useTeamAuth'
import SettingsTabContainer from './SettingsTabContainer.vue'
import RoleBadge from './RoleBadge.vue'

// Get unified auth and impersonation functionality
const {
  currentUser,
  currentRole,
  getAvatarFallback,
  startImpersonation,
  isLoading,
  justStartedImpersonation,
  clearSuccessFlag,
} = useTeamAuth()

// Local loading state for impersonation
const isStarting = computed(() => isLoading.value)
const toast = useToast()

// Component state
const searchQuery = ref('')
const impersonationReason = ref('')
const allUsers = ref<any[]>([])
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const isLoadingUsers = ref(false)
const impersonatingUserId = ref<string | null>(null)

// Get Supabase client
const getSupabaseClient = () => {
  const nuxtApp = useNuxtApp()
  if (!nuxtApp?.$teamAuthClient) {
    throw new Error('Supabase client not available')
  }
  return nuxtApp.$teamAuthClient as any
}

// Computed property for displayed users with instant client-side filtering
const displayedUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return allUsers.value
  }

  // For short queries (1-2 chars), filter locally for instant results
  if (searchQuery.value.trim().length < 3) {
    const searchTerm = searchQuery.value.toLowerCase()
    return allUsers.value.filter((user) => {
      const fullName = user.full_name?.toLowerCase() || ''
      const email = user.email?.toLowerCase() || ''
      return fullName.includes(searchTerm) || email.includes(searchTerm)
    })
  }

  // For longer queries, use server search results
  return searchResults.value
})

// Load all users on mount
const loadAllUsers = async () => {
  try {
    isLoadingUsers.value = true
    const supabase = getSupabaseClient()

    // Check if user is super admin
    if (currentRole.value !== 'super_admin') {
      throw new Error('Only super admins can access all users')
    }

    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        user_id,
        role,
        teams!inner (
          id,
          name
        ),
        profiles!inner (
          id,
          full_name,
          email
        )
      `)
      .order('profiles(full_name)')

    if (error) {
      throw error
    }

    const users = (members || []).map((member: any) => ({
      id: member.profiles.id,
      full_name: member.profiles.full_name,
      email: member.profiles.email,
      role: member.role,
      team_name: member.teams.name,
      team_id: member.teams.id,
    }))

    allUsers.value = users
  }
  catch (error: any) {
    console.error('Failed to load users:', error)
    toast.add({
      title: 'Failed to Load Users',
      description: error.message || 'Failed to load users. Please try again.',
      color: 'red',
    })
    allUsers.value = []
  }
  finally {
    isLoadingUsers.value = false
  }
}

// Debounced search
let searchTimeout: NodeJS.Timeout | null = null

const handleSearchInput = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    await performSearch()
  }, 300)
}

// Search function
const performSearch = async () => {
  if (!searchQuery.value.trim() || searchQuery.value.length < 3) {
    searchResults.value = []
    return
  }

  try {
    isSearching.value = true
    const supabase = getSupabaseClient()

    // Check if user is super admin
    if (currentRole.value !== 'super_admin') {
      throw new Error('Only super admins can search all users')
    }

    // For longer queries, use server search results
    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        user_id,
        role,
        teams!inner (
          id,
          name
        ),
        profiles!inner (
          id,
          full_name,
          email
        )
      `)
      .order('profiles(full_name)')

    if (error) {
      throw error
    }

    // Filter results in JavaScript
    const searchTerm = searchQuery.value.toLowerCase()
    const filteredMembers = (members || []).filter((member: any) => {
      const fullName = member.profiles.full_name?.toLowerCase() || ''
      const email = member.profiles.email?.toLowerCase() || ''
      return fullName.includes(searchTerm) || email.includes(searchTerm)
    })

    searchResults.value = filteredMembers.slice(0, 50).map((member: any) => ({
      id: member.profiles.id,
      full_name: member.profiles.full_name,
      email: member.profiles.email,
      role: member.role,
      team_name: member.teams.name,
      team_id: member.teams.id,
    }))
  }
  catch (error: any) {
    console.error('Search error:', error)
    toast.add({
      title: 'Search Failed',
      description: error.message || 'Failed to search users. Please try again.',
      color: 'red',
    })
    searchResults.value = []
  }
  finally {
    isSearching.value = false
  }
}

// Handle impersonation start
const handleStartImpersonation = async (userId: string) => {
  if (!impersonationReason.value.trim()) {
    toast.add({
      title: 'Reason Required',
      description: 'Please provide a reason for impersonation',
      color: 'orange',
    })
    return
  }

  try {
    impersonatingUserId.value = userId
    await startImpersonation(userId, impersonationReason.value.trim())
  }
  catch (error: any) {
    console.error('Failed to start impersonation:', error)
    // Error handling is already done in useImpersonation
  }
  finally {
    impersonatingUserId.value = null
  }
}

// Helper functions
const getUserInitials = (user: any) => {
  return getAvatarFallback({
    fullName: user.full_name,
    email: user.email,
  })
}

// Note: Modal closing is handled by UserButton watching justStartedImpersonation

// Initialize component
onMounted(() => {
  loadAllUsers()
})
</script>

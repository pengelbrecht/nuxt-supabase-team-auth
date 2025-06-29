<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <!-- Loading state -->
    <UCard
      v-if="isLoading"
      class="w-full max-w-md"
    >
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Processing Invitation
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Setting up your account
          </p>
        </div>
      </template>

      <div class="text-center space-y-4">
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin w-8 h-8 mx-auto text-primary-500"
        />
        <p class="text-gray-600 dark:text-gray-400">
          Loading invitation details...
        </p>
      </div>
    </UCard>

    <!-- Password Setup -->
    <UCard
      v-else
      class="w-full max-w-md"
    >
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Complete Your Invitation
          </h1>
          <p
            v-if="teamName"
            class="text-sm text-gray-600 dark:text-gray-400 mt-2"
          >
            You've been invited to join <strong>{{ teamName }}</strong>
          </p>
          <p
            v-else
            class="text-sm text-gray-600 dark:text-gray-400 mt-2"
          >
            Set up your account to join the team
          </p>
        </div>
      </template>

      <PasswordSetupForm
        :email="userEmail"
        :team-name="teamName"
        @success="handlePasswordSetupSuccess"
        @error="handlePasswordSetupError"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import PasswordSetupForm from '../components/PasswordSetupForm.vue'
import { useTeamAuthConfig } from '../composables/useTeamAuthConfig'

const route = useRoute()
const router = useRouter()
const { getSession } = useSession()
const { loginPage } = useTeamAuthConfig()

// State
const isLoading = ref(true)
const teamId = ref('')
const teamName = ref('')
const userEmail = ref('')

onMounted(async () => {
  console.log('Accept-invite page loaded with params:', route.query)

  try {
    // Get current session (user should be authenticated from email link)
    const session = await getSession()

    if (!session) {
      console.log('No session found, redirecting to signin')
      router.replace(loginPage.value)
      return
    }

    userEmail.value = session.user.email || ''

    // Extract team_id from query params or user metadata
    let teamIdParam = route.query.team_id as string

    if (!teamIdParam && session.user.user_metadata?.team_id) {
      // Fallback to team_id from user metadata (set during invite)
      teamIdParam = session.user.user_metadata.team_id
      console.log('Using team_id from user metadata:', teamIdParam)
    }

    if (!teamIdParam) {
      console.log('No team_id found in query or metadata, redirecting to login page')
      router.replace(loginPage.value)
      return
    }

    teamId.value = teamIdParam

    // Get team name from user metadata or database
    const metadata = session.user.user_metadata
    teamName.value = metadata?.team_name || ''

    if (!teamName.value) {
      // Fetch team name from database
      const supabase = useSupabaseClient()
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamIdParam)
        .single()

      if (team) {
        teamName.value = team.name
      }
    }

    // Check if user is already a member of this team
    const supabase = useSupabaseClient()
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('team_id', teamIdParam)
      .single()

    if (membership) {
      // Already a member, redirect to dashboard
      console.log('User already a team member, redirecting to dashboard')
      router.replace('/dashboard')
      return
    }
  }
  catch (error: any) {
    console.error('Invitation setup error:', error)
    router.replace(loginPage.value)
    return
  }
  finally {
    isLoading.value = false
  }
})

// Handle successful password setup
const handlePasswordSetupSuccess = async () => {
  try {
    // Add user to the team
    const session = await getSession()

    if (!session) {
      throw new Error('No valid session found')
    }

    // Call the accept-invite API to add user to team
    const response = await $fetch('/api/accept-invite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        team_id: teamId.value,
      },
    })

    if (response.success) {
      // Success, redirect to dashboard
      router.replace('/dashboard')
    }
    else {
      throw new Error(response.error || 'Failed to join team')
    }
  }
  catch (error: any) {
    console.error('Team join error:', error)
    // Let the PasswordSetupForm handle the error display
  }
}

// Handle password setup errors
const handlePasswordSetupError = (error: string) => {
  console.error('Password setup error:', error)
  // Error is already displayed by PasswordSetupForm
}

// Set page meta
definePageMeta({
  layout: false, // Use no layout for this page
  auth: false, // Don't require auth since this is handling invitations
})

// Define component name for ESLint
defineOptions({
  name: 'AcceptInvite',
})
</script>

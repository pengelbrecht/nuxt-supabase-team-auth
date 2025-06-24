# Composables API Reference

The module provides several composables for authentication, team management, and session handling.

## `useTeamAuth()`

The primary composable for team-based authentication and management.

### Basic Usage

```typescript
const {
  // Authentication state
  currentUser,
  currentTeam,
  currentRole,
  teamMembers,
  isLoading,
  
  // Authentication methods
  signIn,
  signOut,
  signUpWithTeam,
  
  // Team management
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
  
  // Impersonation (Super Admin only)
  startImpersonation,
  stopImpersonation,
  isImpersonating,
  impersonatedUser,
  originalUser
} = useTeamAuth()
```

### Authentication State

#### `currentUser: Ref<User | null>`
The currently authenticated user object.

```typescript
interface User {
  id: string
  email: string
  user_metadata: {
    name?: string
    avatar_url?: string
  }
  // ... other Supabase user fields
}
```

#### `currentTeam: Ref<Team | null>`
The user's current team information.

```typescript
interface Team {
  id: string
  name: string
  company_name?: string
  company_address_line1?: string
  company_city?: string
  company_state?: string
  company_postal_code?: string
  company_country?: string
  created_at: string
}
```

#### `currentRole: Ref<Role | null>`
The user's role in the current team.

```typescript
type Role = 'super_admin' | 'owner' | 'admin' | 'member'
```

#### `teamMembers: Ref<TeamMember[]>`
Array of team members with their roles.

```typescript
interface TeamMember {
  user_id: string
  team_id: string
  role: Role
  joined_at: string
  user: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}
```

#### `isLoading: Ref<boolean>`
Global loading state for authentication operations.

### Authentication Methods

#### `signIn(email: string, password: string): Promise<void>`
Signs in a user with email and password.

```typescript
try {
  await signIn('user@example.com', 'password')
  // User is now signed in
} catch (error) {
  console.error('Sign in failed:', error)
}
```

#### `signOut(): Promise<void>`
Signs out the current user.

```typescript
await signOut()
```

#### `signUpWithTeam(email: string, password: string, teamName: string): Promise<void>`
Creates a new user account and team simultaneously.

```typescript
try {
  await signUpWithTeam('newuser@example.com', 'securepassword', 'My New Team')
  // User and team are created, user is signed in
} catch (error) {
  if (error.code === 'SIGNUP_FAILED') {
    console.error('Sign up failed:', error.message)
  }
}
```

### Team Management Methods

#### `inviteMember(email: string, role: Role): Promise<void>`
Invites a new member to the team.

**Authorization:** Requires `owner` or `admin` role

```typescript
try {
  await inviteMember('newmember@example.com', 'member')
  // Invitation sent
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    console.error('Insufficient permissions to invite members')
  }
}
```

#### `updateMemberRole(userId: string, newRole: Role): Promise<void>`
Updates a team member's role.

**Authorization:** Role-dependent permissions
- `owner` can change any role except other owners
- `admin` can promote members to admin
- Cannot demote yourself

```typescript
await updateMemberRole('user-123', 'admin')
```

#### `removeMember(userId: string): Promise<void>`
Removes a member from the team.

**Authorization:** Requires `owner` or `admin` role

```typescript
await removeMember('user-123')
```

#### `transferOwnership(newOwnerId: string): Promise<void>`
Transfers team ownership to another member.

**Authorization:** Requires `owner` role

```typescript
await transferOwnership('new-owner-user-id')
```

### Impersonation Methods

#### `startImpersonation(targetUserId: string, reason: string): Promise<void>`
Starts impersonating another user.

**Authorization:** Requires `super_admin` role

```typescript
try {
  await startImpersonation('target-user-id', 'Customer support request')
  // Now impersonating the target user
} catch (error) {
  console.error('Impersonation failed:', error.message)
}
```

#### `stopImpersonation(): Promise<void>`
Stops the current impersonation session.

```typescript
await stopImpersonation()
// Returned to original user session
```

### Impersonation State

#### `isImpersonating: Ref<boolean>`
Whether currently impersonating another user.

#### `impersonatedUser: Ref<User | null>`
The user being impersonated (when active).

#### `originalUser: Ref<User | null>`
The original user (when impersonating).

#### `impersonationExpiresAt: Ref<Date | null>`
When the impersonation session expires.

### Error Handling

All methods throw structured errors:

```typescript
interface AuthError {
  code: string
  message: string
}
```

Common error codes:
- `SIGNIN_FAILED` - Invalid credentials
- `SIGNUP_FAILED` - Account creation failed
- `PERMISSION_DENIED` - Insufficient permissions
- `TEAM_NOT_FOUND` - Team doesn't exist
- `USER_NOT_FOUND` - User doesn't exist

## `useSupabaseClient()`

Provides access to the configured Supabase client.

```typescript
const supabase = useSupabaseClient()

// Use for custom database operations
const { data, error } = await supabase
  .from('custom_table')
  .select('*')
  .eq('team_id', currentTeam.value?.id)
```

## `useSession()`

Manages cross-tab session synchronization and persistence.

```typescript
const {
  tabId,
  isActiveTab,
  isPrimaryTab,
  lastSyncTime,
  initializeSessionSync,
  broadcastSessionState,
  triggerSessionRecovery,
  performSessionHealthCheck
} = useSession()
```

### Session Health Monitoring

```typescript
const healthCheck = performSessionHealthCheck(
  currentUser,
  currentTeam,
  currentRole,
  isImpersonating,
  impersonationExpiresAt
)

if (!healthCheck.isHealthy) {
  console.warn('Session issues detected:', healthCheck.issues)
  triggerSessionRecovery()
}
```

## `useTeamAuthConfig()`

Access module configuration values.

```typescript
const {
  config,
  debug,
  redirectTo,
  supabaseUrl,
  supabaseKey
} = useTeamAuthConfig()
```

## Advanced Usage Examples

### Custom Authentication Flow

```vue
<script setup>
const { signIn, isLoading, currentUser } = useTeamAuth()

const credentials = ref({
  email: '',
  password: ''
})

const handleCustomSignIn = async () => {
  try {
    await signIn(credentials.value.email, credentials.value.password)
    
    // Custom post-signin logic
    if (currentUser.value?.user_metadata?.needs_onboarding) {
      await navigateTo('/onboarding')
    } else {
      await navigateTo('/dashboard')
    }
  } catch (error) {
    // Handle specific error types
    if (error.code === 'SIGNIN_FAILED') {
      // Show user-friendly error message
      showError('Invalid email or password')
    }
  }
}
</script>
```

### Team Member Management

```vue
<script setup>
const {
  teamMembers,
  currentRole,
  updateMemberRole,
  removeMember,
  inviteMember
} = useTeamAuth()

// Permission checks
const canInviteMembers = computed(() => 
  ['owner', 'admin'].includes(currentRole.value)
)

const canPromoteToAdmin = computed(() => 
  currentRole.value === 'owner'
)

// Member actions
const promoteMember = async (member) => {
  if (member.role === 'member') {
    await updateMemberRole(member.user_id, 'admin')
  }
}

const handleRemoveMember = async (member) => {
  const confirmed = await confirm(`Remove ${member.user.email} from the team?`)
  if (confirmed) {
    await removeMember(member.user_id)
  }
}
</script>
```

### Impersonation Management

```vue
<script setup>
const {
  isImpersonating,
  impersonatedUser,
  originalUser,
  startImpersonation,
  stopImpersonation,
  currentRole
} = useTeamAuth()

const canImpersonate = computed(() => 
  currentRole.value === 'super_admin'
)

const impersonateUser = async (userId, reason) => {
  try {
    await startImpersonation(userId, reason)
    showSuccess(`Now impersonating ${impersonatedUser.value?.email}`)
  } catch (error) {
    showError('Impersonation failed: ' + error.message)
  }
}

const endImpersonation = async () => {
  await stopImpersonation()
  showSuccess(`Returned to ${originalUser.value?.email}`)
}
</script>
```

### Reactive State Watching

```vue
<script setup>
const { currentUser, currentTeam, currentRole } = useTeamAuth()

// Watch for authentication changes
watch(currentUser, (newUser, oldUser) => {
  if (newUser && !oldUser) {
    console.log('User signed in:', newUser.email)
  } else if (!newUser && oldUser) {
    console.log('User signed out')
    navigateTo('/signin')
  }
})

// Watch for team changes
watch(currentTeam, (newTeam) => {
  if (newTeam) {
    console.log('Switched to team:', newTeam.name)
    // Update app state, fetch team-specific data, etc.
  }
})

// Watch for role changes
watch(currentRole, (newRole) => {
  console.log('Role changed to:', newRole)
  // Update UI permissions, redirect if necessary
})
</script>
```
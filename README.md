# Nuxt Supabase Team Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Drop-in Nuxt 3 module for team-based authentication with Supabase.

- ✨ **Team-based authentication** - Built-in support for multi-user teams
- 🔐 **Role-based access control** - Owner, admin, member roles with fine-grained permissions
- 👥 **User impersonation** - Super admin impersonation with audit logging
- 📧 **Native invitations** - Supabase-native invitation system
- 🚀 **Zero configuration** - Works out of the box with sensible defaults
- 🎨 **Nuxt UI components** - Beautiful pre-built auth components
- 📱 **SSR ready** - Full server-side rendering support
- 🔒 **Security first** - Built-in RLS policies and secure session management

## Requirements

This module requires the following peer dependencies:

- **Nuxt 3** (`^3.0.0`)
- **@nuxt/ui** (`^3.1.0`) - UI component framework
- **@nuxt/icon** (`^1.0.0`) - Icon framework (required by Nuxt UI)

## Quick Setup

### Prerequisites

This module requires a **working Nuxt UI application**. If you don't have one, create it first:

```bash
# Create a new Nuxt UI app (recommended)
pnpm create nuxt@latest my-app -t ui

# Or add Nuxt UI to existing Nuxt app
pnpm add @nuxt/ui
```

### 1. Install the Module

```bash
# Add our module to your existing Nuxt UI app
pnpm add nuxt-supabase-team-auth
```

### 2. Configure Nuxt

Add our module to your `nuxt.config.ts` (Nuxt UI should already be configured):

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',                    // Should already be here
    'nuxt-supabase-team-auth'      // Add our module
  ],

  // Configure our module
  teamAuth: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    redirectTo: '/dashboard',      // Where to go after login
    loginPage: '/',                // Where to redirect when auth required (optional, defaults to '/signin')
    debug: true                    // Enable debug mode in development
  }
})
```

### 3. Add Required App Structure

Ensure your `app.vue` has the `<UApp>` wrapper (should already exist in Nuxt UI apps):

```vue
<!-- app.vue -->
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

### 4. Environment Variables

Set up your Supabase environment variables:

```bash
# .env
SUPABASE_URL=http://127.0.0.1:54321              # Your Supabase URL
SUPABASE_ANON_KEY=your-anon-key                  # Your Supabase anon key
SUPABASE_SERVICE_KEY=your-service-key            # For server operations
```

### 5. Ready to Use!

You can now use the auth components in your pages:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <SignedOut>
      <AuthSignIn @signed-in="handleSignedIn" />
      <AuthSignUpWithTeam @signed-up="handleSignedUp" />
    </SignedOut>

    <SignedIn>
      <UserButton :show-name="true" />
      <p>Welcome! You're signed in.</p>
    </SignedIn>
  </div>
</template>

<script setup>
const handleSignedIn = () => {
  console.log('User signed in!')
}

const handleSignedUp = () => {
  console.log('User signed up!')
}
</script>
```

## Basic Usage

### Authentication Components

```vue
<template>
  <div>
    <!-- Show different content based on auth state -->
    <SignedIn>
      <UserButton />
      <p>Welcome, {{ currentUser.email }}!</p>
    </SignedIn>
    
    <SignedOut>
      <AuthSignIn />
    </SignedOut>
  </div>
</template>

<script setup>
const { currentUser } = useTeamAuth()
</script>
```

### Team Management

```vue
<script setup>
const { currentTeam, currentRole, inviteMember } = useTeamAuth()

// Invite a new team member
await inviteMember('newuser@example.com', 'member')

// Check permissions
const canInvite = ['owner', 'admin'].includes(currentRole.value)
</script>
```

### Protected Pages with Middleware

The module provides several middleware options for protecting routes:

```vue
<!-- pages/dashboard.vue - Require any authenticated user -->
<script setup>
definePageMeta({
  middleware: 'require-auth'
})

const { currentUser, currentTeam } = useTeamAuth()
</script>
```

```vue
<!-- pages/admin.vue - Require specific role -->
<script setup>
definePageMeta({
  middleware: 'require-role',
  // Additional middleware options can be passed via route meta
})
</script>
```

**Available Middleware:**
- `require-auth` - Requires authenticated user (redirects to `loginPage` if not signed in)
- `require-team` - Requires team membership
- `require-role` - Requires specific role (configure via meta)
- `redirect-authenticated` - Redirects authenticated users (useful for login pages)
- `impersonation` - Handles impersonation sessions

### Server API Routes

The module automatically adds server API routes for team operations:

```typescript
// Available automatically:
// POST /api/signup-with-team
// POST /api/invite-member  
// POST /api/accept-invite
// POST /api/impersonate (super admin only)
// POST /api/stop-impersonation
```

## Components

### Authentication Components
- `<AuthSignIn />` - Sign in form with email/password
- `<AuthSignUpWithTeam />` - Sign up form with team creation
- `<UserButton />` - User avatar with dropdown menu
- `<SignedIn>` / `<SignedOut>` - Conditional rendering based on auth state

### Team Management Components  
- `<TeamForm />` - Team creation and editing
- `<TeamMembersDialog />` - Team member management
- `<ImpersonationBanner />` - Shows when impersonating users
- `<ProfileForm />` - User profile editing

### Utility Components
- `<DialogBox />` - Base modal component
- `<FormDialog />` - Modal with form controls
- `<ConfirmDialog />` - Confirmation modal

## Composables

### `useTeamAuth()`

The main composable for authentication and team management:

```typescript
const {
  // Auth state
  currentUser,
  currentTeam,
  currentRole,
  isLoading,
  
  // Authentication
  signIn,
  signOut,
  signUpWithTeam,
  
  // Team management
  inviteMember,
  updateMemberRole,
  removeMember,
  
  // Impersonation (super admin only)
  startImpersonation,
  stopImpersonation,
  isImpersonating
} = useTeamAuth()
```

### `useSupabaseClient()`

Access the configured Supabase client:

```typescript
const supabase = useSupabaseClient()
const { data } = await supabase.from('teams').select('*')
```

## Configuration

Configure the module in your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-supabase-team-auth'],
  teamAuth: {
    // Supabase configuration
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    
    // Redirect after authentication
    redirectTo: '/dashboard',
    
    // Enable debug mode
    debug: process.env.NODE_ENV === 'development',
    
    // Custom email templates
    emailTemplates: {
      invite: 'custom-invite-template',
      welcome: 'custom-welcome-template'
    }
  }
})
```

## Database Setup

The module requires specific Supabase database tables and policies. Use the CLI to set up your database:

```bash
# Initialize the module in your Supabase project
npx team-auth init

# Apply migrations
npx team-auth migrate
```

Or manually apply the migrations from the `supabase/migrations` directory.

### Required Tables

- `teams` - Team information
- `team_members` - Team membership and roles  
- `profiles` - User profile data
- `impersonation_sessions` - Audit log for impersonation

## Security Features

### Row Level Security (RLS)
- Users can only access their own team data
- Role-based permissions for team operations
- Super admin access controls for impersonation

### Role Hierarchy
- **Super Admin** - Platform-wide access and impersonation
- **Owner** - Full team control, can manage all members
- **Admin** - Can invite members and manage team settings  
- **Member** - Basic team access

### Impersonation Audit
- All impersonation sessions are logged
- Time-limited sessions with automatic expiry
- Reason tracking for compliance

## Middleware

The module provides middleware for route protection:

- `auth.global.ts` - Global authentication check
- `require-auth.ts` - Require authenticated user
- `require-role.ts` - Require specific role
- `require-team.ts` - Require team membership
- `impersonation.ts` - Handle impersonation sessions

## Examples

### Custom Authentication Flow

```vue
<template>
  <div>
    <form @submit="handleSignUp">
      <input v-model="email" type="email" required />
      <input v-model="password" type="password" required />
      <input v-model="teamName" placeholder="Team name" required />
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Creating...' : 'Create Team' }}
      </button>
    </form>
  </div>
</template>

<script setup>
const { signUpWithTeam, isLoading } = useTeamAuth()

const email = ref('')
const password = ref('')
const teamName = ref('')

const handleSignUp = async () => {
  try {
    await signUpWithTeam(email.value, password.value, teamName.value)
    await navigateTo('/dashboard')
  } catch (error) {
    console.error('Sign up failed:', error)
  }
}
</script>
```

### Team Member Management

```vue
<template>
  <div>
    <h2>Team Members</h2>
    <div v-for="member in teamMembers" :key="member.user_id">
      <span>{{ member.user.email }}</span>
      <RoleBadge :role="member.role" />
      <button 
        v-if="canPromote(member)" 
        @click="promoteMember(member.user_id)"
      >
        Promote
      </button>
    </div>
  </div>
</template>

<script setup>
const { teamMembers, currentRole, updateMemberRole } = useTeamAuth()

const canPromote = (member) => {
  return currentRole.value === 'owner' && member.role === 'member'
}

const promoteMember = async (userId) => {
  await updateMemberRole(userId, 'admin')
}
</script>
```

## Troubleshooting

### Common Integration Issues

#### Module Order Doesn't Matter
Module order in your `nuxt.config.ts` does **not** affect functionality - both of these work identically:
```typescript
// Both work the same way
modules: ['@nuxt/ui', 'nuxt-supabase-team-auth']
modules: ['nuxt-supabase-team-auth', '@nuxt/ui']
```

#### Missing Nuxt UI Setup
If you see errors about missing components or context providers:

```bash
# Ensure you started with a Nuxt UI app
pnpm create nuxt@latest my-app -t ui

# Or verify your app.vue has the UApp wrapper
# app.vue should contain:
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

#### Server API Errors
If you see errors like `undefined/functions/v1/...`:

1. **Check environment variables** - Ensure your `.env` file has correct Supabase values
2. **Restart dev server** - Environment changes require restart
3. **Verify Supabase is running** - Local development needs `supabase start`

#### Middleware Errors
If you see `Unknown route middleware: 'require-auth'`:

1. **Restart dev server** - Middleware changes require full restart
2. **Verify module installation** - Run `pnpm install` to ensure module is properly linked

#### SSR Hydration Issues
If you see hydration mismatches, they're handled automatically by our components. The module uses `ClientOnly` wrappers where needed.

### Version Compatibility

This module is tested with:
- **Nuxt**: `^3.17.5`
- **@nuxt/ui**: `^3.1.3`
- **@nuxt/icon**: `^1.2.49`

### Common Patterns

#### Starting Fresh
```bash
# Create new Nuxt UI app
pnpm create nuxt@latest my-team-app -t ui
cd my-team-app

# Add our module
pnpm add nuxt-supabase-team-auth

# Configure in nuxt.config.ts
# Add environment variables
# Start building!
```

#### Integration Testing
Use our minimal test app as reference:
- `test-projects/minimal-nuxt-ui-app/` - Working integration example
- Shows proper component usage and middleware setup

## Development

```bash
# Install dependencies
pnpm install

# Generate types
pnpm run types:generate

# Start the playground
pnpm run dev

# Run tests
pnpm run test

# Build the module
pnpm run build
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting a PR.

## License

[MIT](./LICENSE) License © 2024

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-supabase-team-auth/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-supabase-team-auth

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-supabase-team-auth.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npmjs.com/package/nuxt-supabase-team-auth

[license-src]: https://img.shields.io/npm/l/nuxt-supabase-team-auth.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-supabase-team-auth

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
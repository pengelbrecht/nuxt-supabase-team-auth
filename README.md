# Nuxt Supabase Team Auth

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

> **📚 Documentation Notice**  
> This README is for **developers using this module in their applications**. If you're looking to contribute to the module itself, please see:
> - [MODULE_DEVELOPMENT.md](./MODULE_DEVELOPMENT.md) - Guide for module contributors
> - [CONTRIBUTING.md](./docs/CONTRIBUTING.md) - Contribution guidelines and commit conventions

Drop-in Nuxt 3 module for team-based authentication with Supabase.

- ✨ **Team-based authentication** - Built-in support for multi-user teams
- 🔐 **Role-based access control** - Owner, admin, member roles with
  fine-grained permissions
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

The module automatically installs and configures **@nuxtjs/supabase** (`^1.5.0`) if not already present.

## Quick Setup

### Prerequisites

This module requires a **working Nuxt UI application**. If you don't have one,
create it first:

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

#### Required: Cookie Package Override

Due to a [known dependency conflict](https://github.com/supabase/ssr/issues/62) between Nuxt and Supabase, you need to add a package override to your `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "cookie": "0.7.2"
    }
  }
}
```

**Why is this needed?** Nuxt/Nitro uses `cookie@1.x` while `@supabase/ssr` expects `cookie@0.7.x`. This override ensures compatibility until Supabase resolves the upstream dependency conflict.

### 2. Configure Nuxt

Add our module to your `nuxt.config.ts`. The module automatically registers and configures `@nuxtjs/supabase`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',                    // Should already be here
    'nuxt-supabase-team-auth'      // Add our module (auto-configures @nuxtjs/supabase)
  ],

  // Configure team-auth module
  teamAuth: {
    redirectTo: '/dashboard',           // Where to go after login
    loginPage: '/signin',              // Your sign-in page route  
    defaultProtection: 'public',       // Most routes are public by default
    protectedRoutes: ['/dashboard'],   // Only these routes require auth
    publicRoutes: ['/about'],          // Additional public routes
    socialProviders: {
      google: { enabled: true }        // Configure social providers
    },
    debug: true                        // Enable debug logging (optional)
  }
})
```

#### Configuration Options

**Team Auth Module Configuration (`teamAuth` key):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redirectTo` | `string` | `'/dashboard'` | Where to redirect after successful auth |
| `loginPage` | `string` | `'/signin'` | Your sign-in page route |
| `defaultProtection` | `'public'\|'protected'` | `'public'` | Default route protection mode |
| `protectedRoutes` | `string[]` | `['/dashboard']` | Routes that require authentication |
| `publicRoutes` | `string[]` | `[]` | Additional public routes |
| `socialProviders.google.enabled` | `boolean` | `true` | Enable Google OAuth |
| `debug` | `boolean` | Auto-detected | Enable debug logging |

#### Route Protection Modes

**Public by Default (Recommended)**
```typescript
teamAuth: {
  defaultProtection: 'public',       // Most routes are public
  protectedRoutes: ['/dashboard'],   // Only specific routes need auth
}
```

**Protected by Default**
```typescript
teamAuth: {
  defaultProtection: 'protected',    // All routes require auth
  publicRoutes: ['/', '/about'],     // Except these specific routes
}
```

**Important Notes:**
- The module automatically installs and configures `@nuxtjs/supabase` using the `installModule()` pattern
- Route protection is configured in `teamAuth.defaultProtection` - no need to configure `@nuxtjs/supabase` separately
- Environment variables are automatically detected from your `.env` file

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
SUPABASE_URL=http://127.0.0.1:54321          # Your Supabase URL
SUPABASE_ANON_KEY=your-anon-key             # Your Supabase anon key  
SUPABASE_SERVICE_KEY=your-service-key        # For server operations
```

**Environment Variables:**
- `SUPABASE_URL` - Supabase project URL (used by both client and server)
- `SUPABASE_ANON_KEY` - Supabase anon key (used by both client and server)
- `SUPABASE_SERVICE_KEY` - Server-side service role key

The module automatically reads these variables and configures them for both client and server usage.

### 5. Create Your Pages

Create your authentication pages with proper error handling:

```vue
<!-- pages/signin.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center">
    <AuthSignIn 
      @success="handleSignIn" 
      @error="handleError" 
    />
  </div>
</template>

<script setup>
// Redirect authenticated users away from sign-in
definePageMeta({
  middleware: 'redirect-authenticated'
})

const router = useRouter()
const toast = useToast()

const handleSignIn = () => {
  router.push('/dashboard')
}

const handleError = (error) => {
  toast.add({
    title: 'Sign In Failed',
    description: error,
    color: 'red'
  })
}
</script>
```

```vue
<!-- pages/dashboard.vue -->
<template>
  <div>
    <SignedIn>
      <h1>Welcome to Dashboard</h1>
      <UserButton :show-name="true" />
      <p>Your role: <RoleBadge :role="currentRole" /></p>
    </SignedIn>
  </div>
</template>

<script setup>
// Require authentication for this page
definePageMeta({
  middleware: 'require-auth'
})

const { currentRole } = useTeamAuth()
</script>
```

## Components Reference

### Authentication Components

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<AuthSignIn />` | Email/password sign-in form | `title`, `subtitle`, `showSocialLogin` | User authentication |
| `<AuthSignUpWithTeam />` | Sign-up form with team creation | `title`, `subtitle`, `showSocialLogin` | New user onboarding |
| `<UserButton />` | User avatar with dropdown menu | `size`, `showName`, `customItems`, `customItemsPosition` | User menu and settings |

### Conditional Rendering Components  

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<SignedIn>` | Shows content only when authenticated | None (slots only) | Conditional auth content |
| `<SignedOut>` | Shows content only when not authenticated | None (slots only) | Login/public content |

### User Interface Components

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<ImpersonationBanner />` | Warning banner during impersonation | None (auto-shows) | Impersonation indicator |
| `<RoleBadge />` | Visual role indicator | `role`, `size`, `variant` | Display user permissions |
| `<UserCard />` | User profile display card | User data props | Team member listings |

### Team Management Components

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<TeamMembersDialog />` | Team member management modal | `modelValue` | Team member management |
| `<TeamForm />` | Team creation/editing form | Team data props | Team settings management |
| `<ProfileForm />` | User profile editing form | Profile data props | User account management |

### Dialog & Modal Components

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<DialogBox />` | Base modal component | `modelValue`, `title`, `subtitle` | Custom dialogs |
| `<FormDialog />` | Modal with form controls | `modelValue`, `title`, `hasChanges` | Form-based dialogs |
| `<ConfirmDialog />` | Confirmation modal | `modelValue`, `title`, `message` | User confirmations |
| `<SettingsModal />` | User/team settings modal | `modelValue`, `tab` | Settings management |

### Specialized Components  

| Component | Description | Key Props | Purpose |
|-----------|-------------|-----------|---------|
| `<TeamAuthConfirmation />` | Email confirmation handler | Confirmation data | Email verification |
| `<SuperAdminImpersonationContent />` | Impersonation control panel | None | Super admin controls |

### Component Usage Examples

```vue
<!-- Basic authentication -->
<SignedOut>
  <AuthSignIn @success="handleSignIn" />
</SignedOut>

<SignedIn>
  <UserButton :show-name="true" size="md" />
</SignedIn>

<!-- UserButton with custom menu items -->
<UserButton 
  :show-name="true"
  :custom-items="customMenuItems"
  custom-items-position="before-signout"
/>

<!-- Team management -->
<TeamMembersDialog v-model="showTeamDialog" />

<!-- Role display -->
<RoleBadge :role="user.role" size="sm" />

<!-- Impersonation indicator (auto-shows) -->
<ImpersonationBanner />

<!-- Custom dialogs -->
<FormDialog 
  v-model="showForm"
  title="Edit Settings"
  :has-changes="formChanged"
  @save="handleSave"
>
  <!-- Form content -->
</FormDialog>
```

#### UserButton Custom Menu Items

The `UserButton` component supports custom menu items that integrate seamlessly with the built-in user menu:

```typescript
// Define your custom menu items
import type { CustomMenuItem } from 'nuxt-supabase-team-auth'

const customMenuItems: CustomMenuItem[] = [
  {
    label: 'Billing & Plans',
    icon: 'i-lucide-credit-card',
    to: '/billing',
    requiredRole: 'admin' // Only show for admins and owners
  },
  {
    label: 'Help & Support',
    icon: 'i-lucide-help-circle',
    href: 'https://docs.example.com',
    target: '_blank'
  },
  {
    label: 'Send Feedback',
    icon: 'i-lucide-message-circle',
    onSelect: () => openFeedbackModal(),
    addSeparator: true // Add separator after this item
  }
]
```

```vue
<template>
  <UserButton 
    :custom-items="customMenuItems"
    custom-items-position="before-signout"
    :show-name="true"
  />
</template>
```

**CustomMenuItem Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Display text for the menu item |
| `icon` | `string` | Icon name (e.g., `'i-lucide-settings'`) |
| `to` | `string` | Internal route to navigate to |
| `href` | `string` | External URL to navigate to |
| `target` | `string` | Link target (e.g., `'_blank'`) |
| `onSelect` | `function` | Custom click handler (overrides navigation) |
| `disabled` | `boolean` | Disable the menu item |
| `requiredRole` | `string` | Required role: `'member'`, `'admin'`, `'owner'`, `'super_admin'` |
| `addSeparator` | `boolean` | Add a separator line after this item |

**Positioning Options:**

- `after-user-info` - After user name/email header
- `after-main-actions` - After Settings/Company/Team items  
- `before-signout` - Before sign out section *(default)*

Custom items are automatically filtered based on user roles and integrate seamlessly with the existing menu structure.

## Composables API

### `useTeamAuth()`

The primary composable for team-based authentication and management:

```typescript
const {
  // Authentication state
  currentUser,              // Ref<User | null>
  currentProfile,           // Ref<Profile | null>
  currentTeam,              // Ref<Team | null>
  currentRole,              // Ref<Role | null>
  teamMembers,              // Ref<TeamMember[]>
  isLoading,                // Ref<boolean>
  
  // Impersonation state
  isImpersonating,          // Ref<boolean>
  impersonatedUser,         // Ref<User | null>
  originalUser,             // Ref<User | null>
  impersonationExpiresAt,   // Ref<Date | null>
  justStartedImpersonation, // Ref<boolean> - UI flag for modal dismissal
  
  // Authentication methods
  signIn,                   // (email: string, password: string) => Promise<void>
  signOut,                  // () => Promise<void>
  signUpWithTeam,           // (email: string, password: string, teamName: string) => Promise<void>
  
  // Profile management
  getProfile,               // () => Promise<Profile | null>
  updateProfile,            // (updates: Partial<Profile>) => Promise<void>
  
  // Team management
  updateTeam,               // (updates: Partial<Team>) => Promise<void>
  renameTeam,               // (name: string) => Promise<void>
  deleteTeam,               // () => Promise<void>
  
  // Member management
  inviteMember,             // (email: string, role: string) => Promise<void>
  updateMemberRole,         // (userId: string, newRole: string) => Promise<void>
  removeMember,             // (userId: string) => Promise<void>
  promote,                  // (userId: string) => Promise<void> - Promote to admin
  demote,                   // (userId: string) => Promise<void> - Demote to member
  transferOwnership,        // (userId: string) => Promise<void>
  getTeamMembers,           // () => Promise<TeamMember[]>
  
  // Invitation management
  getPendingInvitations,    // () => Promise<Invitation[]>
  revokeInvite,            // (userId: string) => Promise<void>
  resendInvite,            // (userId: string) => Promise<void>
  
  // Member profiles
  getTeamMemberProfile,     // (userId: string) => Promise<Profile | null>
  updateTeamMemberProfile,  // (userId: string, updates: Partial<Profile>) => Promise<void>
  
  // Impersonation (Super Admin only)
  startImpersonation,       // (targetUserId: string, reason: string) => Promise<void>
  stopImpersonation,        // () => Promise<void>
  
  // Session management
  sessionHealth,            // () => SessionHealthCheck
  triggerSessionRecovery,   // () => void
  refreshAuthState,         // () => Promise<void>
  
  // Utility methods
  getAvatarFallback,        // (overrides?: {fullName?: string, email?: string}) => string
  clearSuccessFlag          // () => void - Clear justStartedImpersonation flag
} = useTeamAuth()
```

### Role Hierarchy

```typescript
type Role = 'super_admin' | 'owner' | 'admin' | 'member'
```

- **Super Admin** - Platform-wide access and impersonation
- **Owner** - Full team control, can manage all members
- **Admin** - Can invite members and manage team settings  
- **Member** - Basic team access

### Error Handling

All methods throw structured errors:

```typescript
interface AuthError {
  code: string
  message: string
}
```

Common error codes: `SIGNIN_FAILED`, `SIGNUP_FAILED`, `PERMISSION_DENIED`,
`TEAM_NOT_FOUND`, `USER_NOT_FOUND`

## Middleware

The module provides middleware for route protection:

### Available Middleware

| Middleware | Purpose | Usage |
|------------|---------|-------|
| `require-auth` | Requires any authenticated user | Basic protected routes |
| `require-team` | Requires team membership | Team-specific pages |
| `require-role` | Requires specific roles | Admin/owner only pages |
| `redirect-authenticated` | Redirects authenticated users | Login pages |
| `impersonation` | Handles impersonation sessions | Super admin features |

### Middleware Examples

```vue
<!-- Require authentication -->
<script setup>
definePageMeta({
  middleware: 'require-auth'
})
</script>

<!-- Require specific role -->
<script setup>
definePageMeta({
  middleware: 'require-role',
  requireRole: ['admin', 'owner']
})
</script>

<!-- Redirect if already signed in -->
<script setup>
definePageMeta({
  middleware: 'redirect-authenticated'
})
</script>
```

## Server API

The module automatically provides server API endpoints:

### Authentication Endpoints

| Endpoint | Method | Purpose | Authorization |
|----------|--------|---------|---------------|
| `/api/signup-with-team` | POST | Create user + team | None |
| `/api/invite-member` | POST | Invite team member | Owner/Admin |
| `/api/accept-invite` | POST | Accept invitation | None |

### Impersonation Endpoints

| Endpoint | Method | Purpose | Authorization |
|----------|--------|---------|---------------|
| `/api/impersonate` | POST | Start impersonation | Super Admin |
| `/api/stop-impersonation` | POST | End impersonation | Super Admin |

### Example API Usage

```typescript
// Sign up with team
const response = await $fetch('/api/signup-with-team', {
  method: 'POST',
  body: {
    email: 'user@example.com',
    password: 'securepassword',
    teamName: 'My Team'
  }
})

// Invite member (requires auth headers)
await $fetch('/api/invite-member', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: {
    email: 'newmember@example.com',
    role: 'member',
    teamId: 'team-id'
  }
})
```

## User Impersonation

Super admins can temporarily act as other users for support and debugging:

### Impersonation Features

- **Audit Logging** - All sessions logged with reason and timestamps
- **Time Limits** - Automatic session expiry (30 minutes default)
- **Visual Indicators** - Clear banner when impersonating
- **Session Isolation** - Original session preserved and restored

### Impersonation Usage

```vue
<script setup>
const { 
  startImpersonation, 
  stopImpersonation, 
  isImpersonating,
  currentRole 
} = useTeamAuth()

// Check permission
const canImpersonate = computed(() => 
  currentRole.value === 'super_admin'
)

// Start impersonation
const impersonateUser = async (userId) => {
  await startImpersonation(userId, 'Customer support request')
}

// Stop impersonation  
const endImpersonation = async () => {
  await stopImpersonation()
}
</script>

<template>
  <!-- Impersonation banner shows automatically -->
  <ImpersonationBanner />
  
  <!-- Impersonation controls for super admins -->
  <SuperAdminImpersonationContent v-if="canImpersonate" />
</template>
```

## Database & Edge Functions Setup

The module requires both database schema and Edge Functions to be deployed to your Supabase project:

### Required Database Tables

- `teams` - Team information
- `team_members` - Team membership and roles  
- `profiles` - User profile data
- `impersonation_sessions` - Audit log for impersonation

### Required Edge Functions

The module depends on 7 Edge Functions for team management and authentication:

- `create-team-and-owner` - Team creation and OAuth signup
- `accept-invite` - Team invitation acceptance
- `invite-member` - Send team invitations
- `revoke-invitation` - Cancel invitations
- `get-pending-invitations` - List pending invites
- `transfer-ownership` - Transfer team ownership
- `stop-impersonation` - Super admin impersonation

### Setup Commands

**For Local Development:**
```bash
# Start Supabase locally
supabase start

# Apply database migrations
supabase db reset
```

**For Production/Cloud Deployment:**
```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply database migrations
supabase db push

# Deploy ALL Edge Functions (required!)
supabase functions deploy

# Or deploy individual functions:
supabase functions deploy create-team-and-owner
supabase functions deploy accept-invite
supabase functions deploy invite-member
# ... (deploy all 7 functions)
```

**⚠️ Important:** Both database migrations AND Edge Functions must be deployed for the module to work correctly. Missing Edge Functions will result in 404 errors when using team management features.

## CLI Commands

The module includes a CLI to simplify database setup and development tasks. After installing the module, the CLI is available in multiple ways:

**For projects with the module installed:**
```bash
# Via node_modules (direct)
./node_modules/.bin/team-auth init

# Via package manager exec
pnpm exec team-auth init
npm exec team-auth init

# Via package.json scripts (recommended)
{
  "scripts": {
    "setup": "team-auth init"
  }
}
```

**For one-time usage or without local install:**
```bash
# Via npx (downloads and runs)
npx nuxt-supabase-team-auth init
```

### Installation & Setup Commands

#### `npx nuxt-supabase-team-auth init`

Initialize the module in your Supabase project by copying migrations and Edge Functions:

```bash
# Initialize in a new Supabase project
npx nuxt-supabase-team-auth init

# Force overwrite existing files
npx nuxt-supabase-team-auth init --force
```

**What it does:**
- Copies all required database migrations to `supabase/migrations/`
- Copies all Edge Functions to `supabase/functions/`
- Detects conflicting tables and warns before proceeding
- Sets up version tracking for future updates
- Adds npm script shortcuts to your `package.json`

**Prerequisites:**
- Must be run from a Supabase project directory (with `supabase/config.toml`)
- Run `supabase init` first if starting fresh

#### `npx nuxt-supabase-team-auth migrate`

Apply new migrations when updating the module:

```bash
# Check and apply new migrations
npx nuxt-supabase-team-auth migrate

# Preview what would be applied without making changes
npx nuxt-supabase-team-auth migrate --dry-run
```

**What it does:**
- Compares your current module version with installed version
- Copies only new migration files and Edge Functions
- Updates version tracking to prevent duplicate applications
- Automatically applies migrations to local database if Supabase is running

### Development & Debugging Commands

#### `npx nuxt-supabase-team-auth cleanup`

Clean up test data and manage teams during development:

```bash
# Reset entire database (like supabase db reset)
npx nuxt-supabase-team-auth cleanup --all

# Clean only test users (emails ending with @example.com)
npx nuxt-supabase-team-auth cleanup --test-data

# Delete a specific team by ID
npx nuxt-supabase-team-auth cleanup --team 12345678-1234-1234-1234-123456789abc
```

**Safety features:**
- Confirmation prompts for destructive operations
- UUID validation for team IDs
- Uses specialized Edge Functions to bypass RLS constraints

#### `npx nuxt-supabase-team-auth db`

Inspect your database and Supabase services:

```bash
# Show Supabase services status
npx nuxt-supabase-team-auth db --status

# List all teams in the database
npx nuxt-supabase-team-auth db --teams

# List all users (limited to 50 for performance)
npx nuxt-supabase-team-auth db --users
```

### Usage Examples

**Setting up a new project:**
```bash
# 1. Create Supabase project
supabase init

# 2. Initialize team-auth
npx nuxt-supabase-team-auth init

# 3. Start local development
supabase start

# 4. Verify setup
npx nuxt-supabase-team-auth db --status
```

**Updating to a new module version:**
```bash
# 1. Update the npm package
pnpm update nuxt-supabase-team-auth

# 2. Apply new migrations
npx nuxt-supabase-team-auth migrate

# 3. Deploy to production when ready
supabase db push
supabase functions deploy
```

**Development workflow:**
```bash
# Clean test data between tests
npx nuxt-supabase-team-auth cleanup --test-data

# Check what's in the database
npx nuxt-supabase-team-auth db --teams
npx nuxt-supabase-team-auth db --users

# Delete problematic test team
npx nuxt-supabase-team-auth cleanup --team <team-id>
```

### Integration with package.json

After running the init command, you can add convenience scripts to your `package.json`:

```json
{
  "scripts": {
    "setup": "team-auth init",
    "migrate": "team-auth migrate",
    "db:clean": "team-auth cleanup --test-data"
  }
}
```

This allows team members to easily run commands:
```bash
pnpm run setup     # Initialize team-auth
pnpm run migrate   # Apply new migrations  
pnpm run db:clean  # Clean test data
```

## Team Management Examples

### Basic Team Operations

```vue
<script setup>
const {
  currentTeam,
  currentRole,
  teamMembers,
  inviteMember,
  updateMemberRole,
  removeMember
} = useTeamAuth()

// Permission checks
const canInviteMembers = computed(() => 
  ['owner', 'admin'].includes(currentRole.value)
)

// Invite new member
const handleInvite = async (email, role) => {
  try {
    await inviteMember(email, role)
    console.log('Invitation sent successfully')
  } catch (error) {
    console.error('Failed to invite:', error.message)
  }
}

// Promote member
const promoteMember = async (userId) => {
  await updateMemberRole(userId, 'admin')
}

// Remove member
const handleRemove = async (userId) => {
  const confirmed = confirm('Remove this member?')
  if (confirmed) {
    await removeMember(userId)
  }
}
</script>

<template>
  <div>
    <h2>{{ currentTeam?.name }}</h2>
    <p>Your role: <RoleBadge :role="currentRole" /></p>
    
    <!-- Team member list -->
    <div v-for="member in teamMembers" :key="member.user_id">
      <UserCard :user="member.user" :role="member.role" />
      <UButton 
        v-if="canInviteMembers && member.role === 'member'"
        @click="promoteMember(member.user_id)"
      >
        Promote to Admin
      </UButton>
    </div>
    
    <!-- Invite new member -->
    <TeamMembersDialog v-if="canInviteMembers" />
  </div>
</template>
```

## Troubleshooting

### Common Integration Issues

#### Module Order Doesn't Matter

Module order in your `nuxt.config.ts` does **not** affect functionality:

```typescript
// Both work the same way
modules: ['@nuxt/ui', 'nuxt-supabase-team-auth']
modules: ['nuxt-supabase-team-auth', '@nuxt/ui']
```

#### Missing Nuxt UI Setup

If you see errors about missing components:

```bash
# Ensure you started with a Nuxt UI app
pnpm create nuxt@latest my-app -t ui

# Verify app.vue has UApp wrapper:
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

#### Server API Errors

If you see errors like `undefined/functions/v1/...`:

1. **Check environment variables** - Ensure `.env` has correct Supabase values
2. **Restart dev server** - Environment changes require restart  
3. **Verify Supabase is running** - Local development needs `supabase start`

#### Middleware Errors

If you see `Unknown route middleware: 'require-auth'`:

1. **Restart dev server** - Middleware changes require full restart
2. **Verify module installation** - Run `pnpm install`

#### SSR Hydration Issues

Hydration mismatches are handled automatically by our components using `ClientOnly` wrappers where needed.

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

# Configure in nuxt.config.ts (see configuration section above)
# Add environment variables
# Start building!
```

#### Integration Testing

Use our minimal test app as reference:

- `test-projects/minimal-nuxt-ui-app/` - Working integration example
- Shows proper component usage and middleware setup

### Migration from Previous Versions

If you're updating from a previous version of this module (< v0.3.6), you need to update your configuration:

#### Required Changes

1. **Remove separate @nuxtjs/supabase configuration:**
```typescript
// REMOVE: No longer needed - module handles this automatically
supabase: {
  url: process.env.SUPABASE_URL,           // Remove
  key: process.env.SUPABASE_ANON_KEY,      // Remove
  redirectOptions: { ... }                 // Remove
},
```

2. **Update teamAuth configuration:**
```typescript
// BEFORE: Mixed configuration
teamAuth: {
  supabaseUrl: process.env.SUPABASE_URL,    // Remove
  supabaseKey: process.env.SUPABASE_ANON_KEY, // Remove
  redirectTo: '/dashboard',
  loginPage: '/signin',
}

// AFTER: Unified configuration with route protection
teamAuth: {
  redirectTo: '/dashboard',
  loginPage: '/signin', 
  defaultProtection: 'public',              // NEW: Route protection mode
  protectedRoutes: ['/dashboard'],          // NEW: Specific protected routes
  socialProviders: {
    google: { enabled: true }
  }
}
```

3. **Environment variables remain the same:**
```bash
# The module reads these standard env vars:
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

4. **Add error handling to auth pages:**
```vue
<!-- BEFORE: Only success handler -->
<AuthSignIn @success="handleSignIn" />

<!-- AFTER: Add error handler for user feedback -->
<AuthSignIn 
  @success="handleSignIn" 
  @error="handleError" 
/>

<script setup>
const toast = useToast()
const handleError = (error) => {
  toast.add({ title: 'Sign In Failed', description: error, color: 'red' })
}
</script>
```
```

#### Benefits of New Architecture

- **Simplified Configuration** - Single `teamAuth` config block, no separate Supabase setup
- **Automatic Dependency Management** - Uses `installModule()` pattern for proper integration
- **Flexible Route Protection** - Choose between public-by-default or protected-by-default modes
- **Standard Environment Variables** - Uses standard Supabase env var names
- **Improved Error Handling** - Components emit errors for proper user feedback

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

Contributions are welcome! Please read our [contributing guidelines]
(CONTRIBUTING.md) before submitting a PR.

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

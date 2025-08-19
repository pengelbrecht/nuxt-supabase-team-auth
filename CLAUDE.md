# Claude Development Notes

## Project Overview
- **Nuxt 3 Module** - Drop-in authentication module for team-based applications
- **Version**: 0.4.2
- **Purpose**: Provides complete team authentication with Supabase integration
- **Key Features**: Team management, role-based access control (RBAC), user invitations, impersonation
- **Dependencies**: @nuxtjs/supabase, @nuxt/ui, @nuxt/icon (peer dependencies)

## Project Type
- **This is a Nuxt Module** - designed to be installed in other Nuxt projects
- The `/playground` directory is for testing and showcasing the module
- Development happens in `/src/runtime` for module code
- Test the module by running `pnpm run dev` which starts the playground

## Package Manager
- **Always use `pnpm`** - NOT npm or yarn
- Commands: `pnpm install`, `pnpm run dev`, `pnpm run build`, etc.

## Server Routes Architecture
- **Server routes belong in `/src/runtime/server`** - All API routes are part of the module
- **Playground uses symlinks** - Files in `/playground/server` are symlinked to `/src/runtime/server`
- This avoids duplicating files and ensures module code stays in the correct location
- When adding new server routes, create them in `/src/runtime/server` then symlink to playground:
  ```bash
  # Add new route to module
  # /src/runtime/server/api/new-route.post.ts
  
  # Symlink to playground for testing
  cd playground/server/api
  ln -sf ../../../src/runtime/server/api/new-route.post.ts new-route.post.ts
  ```

## Database Architecture (Established - Don't Change)
- **`public.profiles`** table stores user profile data (full_name, avatar_url, etc.)
- **`public.team_members`** table handles team memberships and roles only
- **`public.teams`** table stores team information (name, created_at, etc.)
- **`public.impersonation_sessions`** table tracks active impersonation sessions
- **No JWT claims** - always fetch team data from database via team_members join
- User profile data is stored in `public.profiles.id` which equals `auth.uid()`

## Authentication Flow (Working)
- Sign up creates user + team via Edge Function, then signs in with password
- Sign in fetches team membership from database (not JWT claims)
- Profile updates go to `public.profiles` table
- Password changes go through Supabase auth system
- OAuth (Google) authentication supported with automatic profile creation
- Magic link authentication for team invitations
- Impersonation system for super admins and team owners

## Components (Fixed - Don't Modify)
- **UserButton**: Shows user icon when signed out, user initials when signed in
- **ProfileForm**: Separated password changes from profile updates for better UX
- **AuthSignUpWithTeam**: Working with comprehensive error handling
- **TeamMembersDialog**: Team member management with role assignment
- **ImpersonationBanner**: Shows when user is being impersonated
- **DialogBox/FormDialog/ConfirmDialog**: Consistent dialog system
- **RoleBadge**: Displays user roles with proper styling
- **TeamAuthConfirmation**: Handles email confirmation flow

## Key Lessons Learned
1. **Component loading states** - Use local loading state (`isProfileLoading`) NOT global auth loading state (`isLoading`)
2. **Watchers and background processes** - Watch specific properties (like user ID) not entire objects to avoid unnecessary triggers
3. **Form submission** - Use direct @click handlers instead of UForm @submit for complex forms
4. **Profile reloading** - Don't reload profile data after save, just update local form state
5. **Root cause before fixes** - ALWAYS investigate and understand the actual problem before implementing solutions. Gather facts, test hypotheses systematically, then implement targeted fixes.

## Testing Commands
- `supabase status` - check if services running
- `supabase db reset` - reset database and apply migrations
- `pnpm run dev` - start dev server
- **Use `psql` not supabase cli for terminal/bash sql commands**
- **Don't use `db push` to run local migrations as a remote might be linked and have them applied unintentionally. Instead use `supabase db reset`**
- **Always use Supabase CLI not npx supabase**

## Release Process (CRITICAL)
- **NEVER release/publish before testing locally in the test project**
- Always test changes in `./test-projects/minimal-nuxt-ui-app` first
- Only publish after confirming everything works in the local test environment
- This prevents breaking consumer applications with untested changes

## Database Schema (Stable)
```sql
-- profiles table stores user data
public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  avatar_url text,
  ...
)

-- team_members handles roles and memberships
public.team_members (
  team_id uuid REFERENCES teams(id),
  user_id uuid REFERENCES auth.users(id),
  role text -- 'owner', 'admin', 'member', 'super_admin'
)

-- teams table stores team information
public.teams (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamp,
  ...
)

-- impersonation_sessions tracks active impersonations
public.impersonation_sessions (
  id uuid PRIMARY KEY,
  impersonator_id uuid REFERENCES auth.users(id),
  impersonated_id uuid REFERENCES auth.users(id),
  reason text,
  expires_at timestamp,
  ...
)
```

## CLI Commands and Database Management

### Available CLI Commands
The module includes a `team-auth` CLI for common development tasks:

```bash
# Initialize team-auth in new Supabase project
team-auth init [--force]

# Apply new migrations (after module updates)
team-auth migrate [--dry-run] 

# Database cleanup for development
team-auth cleanup --all          # Reset entire database
team-auth cleanup --test-data    # Clean test users only  
team-auth cleanup --team <id>    # Delete specific team

# Database inspection
team-auth db --status    # Show Supabase status
team-auth db --teams     # List all teams
team-auth db --users     # List all users
```

### Development Database Management
- **Use CLI cleanup commands** instead of manual SQL for consistency
- **team-auth cleanup --test-data** safely removes users with @example.com emails
- **team-auth cleanup --team <uuid>** uses Edge Function to bypass RLS constraints
- **Always backup before cleanup --all** as it runs `supabase db reset`

### Migration Workflow
1. **team-auth init** copies migrations/functions and sets up version tracking
2. **team-auth migrate** applies only new migrations from module updates
3. Version tracking prevents duplicate applications via `.team-auth-version.json`

## Don't Re-implement
- JWT claims parsing (we don't use custom claims)
- Profiles table structure 
- UserButton avatar fallback logic
- ProfileForm UX improvements
- RLS policies (keep them simple - users access own data only)
- Impersonation system (working with proper security)
- Team invitation flow (uses native Supabase invitations)
- Edge Functions for secure operations

## Form/Dialog Design Patterns

### Proven Form Layout Structure
Use this battle-tested hierarchy based on ProfileForm implementation:

```vue
<!-- Parent container card -->
<UCard class="w-full">
  <template #header>
    <!-- Main title and action buttons -->
    <div class="flex justify-between items-center">
      <h2>Form Title</h2>
      <UButton>Primary Action</UButton>
    </div>
  </template>

  <div class="space-y-8">
    <!-- Alert messages -->
    <UAlert v-if="message" />
    
    <UForm>
      <!-- Section cards -->
      <UCard variant="subtle" class="mb-6">
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Section Title
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Section description
          </p>
        </template>
        
        <!-- Standard form fields -->
        <UFormField label="Field Name" name="field_name" required class="flex items-center justify-between mb-4 gap-2">
          <UInput v-model="form.field_name" size="md" />
        </UFormField>
        
        <!-- Avatar-style section with custom layout -->
        <div class="flex items-center mb-4">
          <UAvatar size="xl">PE</UAvatar>
          <div style="width: 1rem; flex-shrink: 0;"></div>
          <UFormField label="File Upload" name="file" description="File requirements" class="flex items-center justify-between gap-2 flex-1">
            <UInput type="file" />
          </UFormField>
        </div>
      </UCard>
    </UForm>
  </div>
</UCard>
```

### Critical Spacing Rules (Hard-Won Lessons)
- **NOT `not-last:pb-4`** - This class doesn't work reliably in Nuxt UI context
- **USE `mb-4`** on individual UFormField components instead of complex selectors
- **Text spacing**: Use `mt-1` for descriptions under headers (not `mt-2`)
- **Card spacing**: `mb-6` between section cards works with Nuxt UI internal spacing
- **Mixed margins**: Sometimes `mb-` works better than `pb-` depending on content flow

### Form Field Patterns

#### Standard Horizontal Fields
```vue
<UFormField 
  label="Field Name" 
  name="field_name" 
  required 
  class="flex items-center justify-between mb-4 gap-2"
>
  <UInput v-model="form.field_name" size="md" />
</UFormField>
```

#### Avatar + File Upload Layout
```vue
<div class="flex items-center mb-4">
  <UAvatar size="xl">{{ initials }}</UAvatar>
  <div style="width: 1rem; flex-shrink: 0;"></div>
  <UFormField 
    label="Profile Picture" 
    name="avatar" 
    description="JPG, GIF or PNG. Max size 2MB." 
    class="flex items-center justify-between gap-2 flex-1"
  >
    <UInput type="file" accept="image/*" />
  </UFormField>
</div>
```

#### Section Headers
```vue
<div class="mb-6">
  <h4 class="font-medium text-gray-900 dark:text-gray-100">Section Name</h4>
  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
    Section explanation text.
  </p>
</div>
```

### Loading States
- **Separate loading states** for different actions (profile vs password)
- Use component-level loading (`isProfileLoading`) not global (`isLoading`)
- Apply loading state to both button and related form fields

### Form Organization
1. **Parent UCard** - Main container with title and primary action
2. **Section UCards** - `variant="subtle"` for logical groupings  
3. **No wrapper divs** - Direct form fields in card content
4. **Independent actions** - Separate buttons for different operations
5. **Inline spacers** - Use `<div style="width: 1rem; flex-shrink: 0;"></div>` for precise spacing

## DialogBox Component System

### Overview
We use a custom DialogBox component system instead of raw UModal to ensure consistency and reduce boilerplate. The system provides three main variants:

- **DialogBox** - Base component for custom dialogs
- **FormDialog** - For forms with save/cancel functionality
- **ConfirmDialog** - For confirmation prompts

### FormDialog - Most Common Pattern
Use FormDialog for forms with automatic save button and change detection:

```vue
<FormDialog
  v-model="showDialog"
  title="Edit User Profile"
  subtitle="Update user information and preferences"
  :has-changes="formHasChanges"
  :loading="isSaving"
  @save="handleSave"
  @close="handleClose"
>
  <!-- Form content without wrapper cards -->
  <UFormField label="Full Name" name="fullName" class="mb-4">
    <UInput v-model="form.fullName" />
  </UFormField>
  
  <UFormField label="Email" name="email" class="mb-4">
    <UInput v-model="form.email" type="email" />
  </UFormField>
</FormDialog>
```

### ConfirmDialog - For Confirmations
Use ConfirmDialog for simple confirm/cancel prompts:

```vue
<ConfirmDialog
  v-model="showConfirm"
  title="Delete User Account"
  message="Are you sure? This action cannot be undone."
  confirm-text="Delete Account"
  confirm-color="red"
  :loading="isDeleting"
  @confirm="handleDelete"
  @cancel="handleCancel"
/>
```

### DialogBox - For Custom Content
Use DialogBox when you need full control over the content and actions:

```vue
<DialogBox
  v-model="showDialog"
  title="Custom Dialog"
  subtitle="With custom actions"
  :loading="isLoading"
>
  <template #actions>
    <UButton @click="customAction">Custom Action</UButton>
  </template>
  
  <!-- Any custom content -->
  <div class="space-y-4">
    <p>Custom content here</p>
  </div>
</DialogBox>
```

### Form Component Integration
When using forms in modals, pass `isModal="true"` to avoid duplicate headers:

```vue
<!-- In SettingsModal -->
<UModal v-model:open="isOpen" title="Settings">
  <template #body>
    <ProfileForm :is-modal="true" @saved="handleSaved" />
  </template>
</UModal>
```

### Key Benefits Over Raw UModal
1. **Consistent styling** - Automatic header layout with title/subtitle/actions
2. **Change detection** - Built-in "unsaved changes" indicator
3. **Loading states** - Automatic disable/loading behavior
4. **Accessibility** - Proper ARIA attributes and keyboard handling
5. **Less boilerplate** - 70% less code than raw UModal
6. **Type safety** - TypeScript props for common patterns

### Critical Rules
1. **No UCard wrapper** - DialogBox components handle their own structure
2. **Use v-model** - All dialogs use `v-model` not `v-model:open`
3. **Section cards only** - Use `UCard variant="subtle"` for field grouping inside dialogs
4. **Form integration** - Always pass `isModal=true` to form components in modals
5. **Responsive by default** - Dialogs automatically adjust to screen size

## New Features and Patterns

### Impersonation System
- **Super admins** can impersonate any user
- **Team owners** can impersonate team members
- Sessions tracked in `impersonation_sessions` table
- Automatic session expiry (24 hours)
- Clear visual indicator (ImpersonationBanner)
- Secure stop-impersonation flow

### Team Invitations
- Native Supabase invitation system
- Magic link authentication for invitees
- Automatic team assignment on acceptance
- Pending invitation management
- Role assignment during invitation

### Middleware System
- **auth.global.ts** - Core authentication middleware
- **require-auth.ts** - Protect authenticated pages
- **require-team.ts** - Ensure user has team access
- **require-role.ts** - Role-based access control
- **redirect-authenticated.ts** - Redirect logged-in users
- **impersonation.ts** - Handle impersonation sessions

### Edge Functions
- **create-team-and-owner** - Atomic team creation
- **delete-team** - Complete team deletion with cleanup
- **invite-member** - Send team invitations
- **accept-invite** - Process invitation acceptance
- **transfer-ownership** - Transfer team ownership
- **stop-impersonation** - End impersonation session

### Testing Infrastructure
- E2E tests with Playwright
- Unit tests with Vitest
- Integration tests for Edge Functions
- Test factories for users and teams
- Automatic test data cleanup
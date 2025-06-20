# Claude Development Notes

## Project Type
- **This is a Nuxt Module** - designed to be installed in other Nuxt projects
- The `/playground` directory is for testing and showcasing the module
- Development happens in `/src/runtime` for module code
- Test the module by running `pnpm run dev` which starts the playground

## Package Manager
- **Always use `pnpm`** - NOT npm or yarn
- Commands: `pnpm install`, `pnpm run dev`, `pnpm run build`, etc.

## Database Architecture (Established - Don't Change)
- **`public.profiles`** table stores user profile data (full_name, avatar_url, etc.)
- **`public.team_members`** table handles team memberships and roles only
- **No JWT claims** - always fetch team data from database via team_members join
- User profile data is stored in `public.profiles.id` which equals `auth.uid()`

## Authentication Flow (Working)
- Sign up creates user + team via Edge Function, then signs in with password
- Sign in fetches team membership from database (not JWT claims)
- Profile updates go to `public.profiles` table
- Password changes go through Supabase auth system

## Components (Fixed - Don't Modify)
- **UserButton**: Shows user icon when signed out, user initials when signed in
- **ProfileForm**: Separated password changes from profile updates for better UX
- **AuthSignUpWithTeam**: Working with comprehensive error handling

## Key Lessons Learned
1. **Component loading states** - Use local loading state (`isProfileLoading`) NOT global auth loading state (`isLoading`)
2. **Watchers and background processes** - Watch specific properties (like user ID) not entire objects to avoid unnecessary triggers
3. **Form submission** - Use direct @click handlers instead of UForm @submit for complex forms
4. **Profile reloading** - Don't reload profile data after save, just update local form state

## Testing Commands
- `supabase status` - check if services running
- `supabase db reset` - reset database and apply migrations
- `pnpm run dev` - start dev server
- **Use `psql` not supabase cli for terminal/bash sql commands**
- **Don't use `db push` to run local migrations as a remote might be linked and have them applied unintentionally. Instead use `supabase db reset`**

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
```

## Don't Re-implement
-  JWT claims parsing (we don't use custom claims)
-  Profiles table structure 
-  UserButton avatar fallback logic
-  ProfileForm UX improvements
-  RLS policies (keep them simple - users access own data only)

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

## UModal Patterns (Critical for Nested Modals)

### Correct UModal Slot Usage
UModal components MUST use the proper slot structure for content to render inside the modal:

```vue
<UModal v-model:open="modalOpen" :ui="{ width: 'sm:max-w-2xl' }">
  <template #header>
    <div class="flex justify-between items-center">
      <div>
        <h2>Modal Title</h2>
        <p>Optional subtitle</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton>Save Changes</UButton>
        <UButton variant="ghost" icon="i-heroicons-x-mark-20-solid" @click="close" />
      </div>
    </div>
  </template>

  <template #body>
    <div class="p-6">
      <!-- Modal content goes here -->
    </div>
  </template>
</UModal>
```

### Critical UModal Rules
1. **Use #body slot** - Content MUST be in `<template #body>` or it will render outside the modal
2. **No UCard inside UModal** - UModal handles its own structure, don't wrap in UCard
3. **Nested modals work** - Use `v-model:open` syntax for proper nesting (SettingsModal > TeamForm > EditUserModal)
4. **Header slot for actions** - Put Save/Close buttons in `#header` slot for consistent layout

### Common UModal Mistakes
- ❌ Putting content directly inside UModal without #body slot
- ❌ Wrapping UModal content in UCard
- ❌ Using `v-model` instead of `v-model:open`
- ❌ Not using template slots for header/body
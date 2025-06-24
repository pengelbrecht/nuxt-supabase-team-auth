# Getting Started with Nuxt Supabase Team Auth

This guide will walk you through integrating the `nuxt-supabase-team-auth` module into your Nuxt application.

## Prerequisites

This module is designed to work with **Nuxt UI applications**. You need a working Nuxt UI setup before adding our module.

### Starting with a New Project

The easiest way is to create a new Nuxt UI application:

```bash
# Create a new Nuxt UI app
pnpm create nuxt@latest my-team-app -t ui
cd my-team-app

# Install and test the base app
pnpm install
pnpm run dev
```

Verify your app works and is properly styled before proceeding.

### Adding to Existing Project

If you have an existing Nuxt 3 app, add Nuxt UI first:

```bash
# Add Nuxt UI dependencies
pnpm add @nuxt/ui @nuxt/icon

# Update your nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'], // If you have custom styles
})
```

Ensure your `app.vue` has the required `<UApp>` wrapper:

```vue
<!-- app.vue -->
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

## Step 1: Install the Module

Add our module to your existing Nuxt UI application:

```bash
pnpm add nuxt-supabase-team-auth
```

## Step 2: Configure the Module

Update your `nuxt.config.ts` to include our module:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',                    // Should already be here
    'nuxt-supabase-team-auth'      // Add our module
  ],

  // Configure team auth
  teamAuth: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    redirectTo: '/dashboard',      // Where to redirect after login
    loginPage: '/',                // Where to redirect when auth is required
    debug: true                    // Enable debug logging in development
  }
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `supabaseUrl` | `string` | - | Your Supabase project URL |
| `supabaseKey` | `string` | - | Your Supabase anon key |
| `redirectTo` | `string` | `'/dashboard'` | Where to redirect after successful authentication |
| `loginPage` | `string` | `'/signin'` | Where to redirect when authentication is required |
| `debug` | `boolean` | Auto-detected | Enable debug logging |

## Step 3: Environment Variables

Create a `.env` file in your project root:

```bash
# .env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
```

For local development, you'll typically use your local Supabase instance. For production, use your hosted Supabase project URLs.

## Step 4: Verify Installation

Restart your development server to pick up the module changes:

```bash
# Stop your dev server (Ctrl+C) and restart
pnpm run dev
```

Check the console for any errors. You should see debug messages if `debug: true` is enabled.

## Step 5: Create Your First Auth Page

Create a simple page that demonstrates the auth components:

```vue
<!-- pages/index.vue -->
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <!-- Header with conditional UserButton -->
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">My Team App</h1>
        <SignedIn>
          <UserButton :show-name="true" />
        </SignedIn>
      </div>

      <!-- Authentication Flow -->
      <SignedOut>
        <UCard class="max-w-2xl mx-auto">
          <template #header>
            <h2 class="text-xl font-semibold">Welcome! Please sign in</h2>
          </template>
          
          <div class="space-y-6">
            <!-- Sign In Form -->
            <AuthSignIn @signed-in="handleSignedIn" />
            
            <!-- Divider -->
            <div class="flex items-center gap-4 my-6">
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              <span class="text-sm text-gray-500 dark:text-gray-400">or</span>
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
            
            <!-- Sign Up Form -->
            <AuthSignUpWithTeam @signed-up="handleSignedUp" />
          </div>
        </UCard>
      </SignedOut>

      <!-- Signed In Content -->
      <SignedIn>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Welcome back!</h2>
          </template>
          
          <div class="space-y-4">
            <p>You're successfully signed in. You can now access protected content.</p>
            
            <UButton to="/dashboard" color="primary" size="lg">
              Go to Dashboard
            </UButton>
          </div>
        </UCard>
      </SignedIn>
    </div>
  </div>
</template>

<script setup>
const handleSignedIn = () => {
  console.log('User signed in successfully')
  // Optional: redirect or show success message
}

const handleSignedUp = () => {
  console.log('User signed up successfully')
  // Optional: redirect or show success message
}
</script>
```

## Step 6: Create a Protected Page

Create a dashboard page that requires authentication:

```vue
<!-- pages/dashboard.vue -->
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <SignedIn>
          <UserButton :show-name="true" />
        </SignedIn>
      </div>

      <!-- Protected Content -->
      <SignedIn>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <!-- User Info -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">User Info</h2>
            </template>
            <div class="space-y-2">
              <p><strong>Email:</strong> {{ currentUser?.email }}</p>
              <p><strong>Name:</strong> {{ currentProfile?.full_name || 'Not set' }}</p>
            </div>
          </UCard>

          <!-- Team Info -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">Team Info</h2>
            </template>
            <div class="space-y-2">
              <p><strong>Team:</strong> {{ currentTeam?.name || 'No team' }}</p>
              <p><strong>Role:</strong> {{ currentRole || 'No role' }}</p>
            </div>
          </UCard>

          <!-- Actions -->
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">Actions</h2>
            </template>
            <div class="space-y-3">
              <UButton @click="handleSignOut" color="red" variant="outline" class="w-full">
                Sign Out
              </UButton>
            </div>
          </UCard>
        </div>
      </SignedIn>
    </div>
  </div>
</template>

<script setup>
// Protect this page with middleware
definePageMeta({
  middleware: 'require-auth'
})

// Get auth state
const { currentUser, currentTeam, currentRole, currentProfile, signOut } = useTeamAuth()

const handleSignOut = async () => {
  await signOut()
  await navigateTo('/')
}
</script>
```

## Step 7: Test the Integration

1. **Start your dev server**: `pnpm run dev`
2. **Visit your app**: Open http://localhost:3000
3. **Test sign up**: Create a new account with team
4. **Test sign in**: Sign in with existing credentials
5. **Test protection**: Try accessing `/dashboard` while signed out
6. **Test middleware**: Verify redirects work correctly

## Common Issues and Solutions

### Module Order
Module order in `nuxt.config.ts` does **not** matter. Both of these work identically:
```typescript
modules: ['@nuxt/ui', 'nuxt-supabase-team-auth']  // ✅ Works
modules: ['nuxt-supabase-team-auth', '@nuxt/ui']  // ✅ Also works
```

### Middleware Not Found
If you see `Unknown route middleware: 'require-auth'`:
1. Restart your dev server completely
2. Ensure the module is properly installed: `pnpm install`

### Component Resolution Issues
If Nuxt UI components aren't working:
1. Verify `<UApp>` wrapper exists in `app.vue`
2. Check that Nuxt UI is properly configured
3. Ensure you started with a working Nuxt UI base

### Environment Variables
If you see `undefined/functions/v1/...` errors:
1. Check your `.env` file has correct values
2. Restart your dev server after changing environment variables
3. Verify Supabase is running (for local development)

## Next Steps

Once you have the basic integration working:

1. **[Component Guide](./components.md)** - Learn about all available components
2. **[Composables Reference](./api/composables.md)** - Explore the useTeamAuth composable
3. **[Middleware Guide](./middleware.md)** - Set up route protection
4. **[Team Management](./team-management.md)** - Add team features
5. **[Server API](./api/server-endpoints.md)** - Understand the backend

## Need Help?

- Check the [troubleshooting guide](./troubleshooting.md)
- Review the [integration notes](./consumer-app-integration-notes.md)
- Look at the minimal example in `test-projects/minimal-nuxt-ui-app/`
# Middleware Guide

The `nuxt-supabase-team-auth` module provides several middleware options for protecting routes and managing authentication flow.

## Available Middleware

### `require-auth`

Requires any authenticated user. Redirects to `loginPage` if not signed in.

```vue
<!-- pages/dashboard.vue -->
<script setup>
definePageMeta({
  middleware: 'require-auth'
})
</script>
```

**Behavior:**
- ✅ Allows any signed-in user
- ❌ Redirects unsigned users to `loginPage` (configured in `nuxt.config.ts`)
- 🔄 Preserves redirect URL for post-login navigation

### `require-team`

Requires the user to be a member of a team.

```vue
<!-- pages/team-dashboard.vue -->
<script setup>
definePageMeta({
  middleware: 'require-team'
})
</script>
```

**Behavior:**
- ✅ Allows users with team membership
- ❌ Redirects users without teams
- 🔄 Checks both authentication and team membership

### `require-role`

Requires specific role(s) for access.

```vue
<!-- pages/admin.vue -->
<script setup>
definePageMeta({
  middleware: 'require-role',
  requireRole: ['admin', 'owner']  // Allow admin or owner
})
</script>
```

**Behavior:**
- ✅ Allows users with specified roles
- ❌ Redirects users with insufficient permissions
- 🔄 Supports multiple role requirements

### `redirect-authenticated`

Redirects authenticated users away (useful for login pages).

```vue
<!-- pages/signin.vue -->
<script setup>
definePageMeta({
  middleware: 'redirect-authenticated'
})
</script>
```

**Behavior:**
- ✅ Allows unsigned users
- ❌ Redirects signed-in users to `redirectTo`
- 🔄 Prevents authenticated users from seeing login forms

### `impersonation`

Handles impersonation sessions and restrictions.

```vue
<!-- pages/super-admin.vue -->
<script setup>
definePageMeta({
  middleware: 'impersonation'
})
</script>
```

**Behavior:**
- ✅ Manages impersonation session state
- ❌ Handles impersonation restrictions
- 🔄 Logs impersonation events

## Configuration

### Global Configuration

Configure redirect behavior in your `nuxt.config.ts`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  teamAuth: {
    redirectTo: '/dashboard',    // Where to go after successful login
    loginPage: '/',              // Where to redirect when auth required
    debug: true                  // Enable middleware debug logging
  }
})
```

### Per-Route Configuration

You can customize middleware behavior per route:

```vue
<script setup>
definePageMeta({
  middleware: 'require-role',
  requireRole: ['admin'],           // Custom role requirement
  redirectTo: '/team-dashboard',    // Custom redirect after auth
  loginPage: '/signin'              // Custom login page for this route
})
</script>
```

## Common Patterns

### Basic Protected Route

```vue
<!-- pages/profile.vue -->
<template>
  <div>
    <h1>User Profile</h1>
    <p>Email: {{ currentUser?.email }}</p>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'require-auth'
})

const { currentUser } = useTeamAuth()
</script>
```

### Admin-Only Section

```vue
<!-- pages/admin/index.vue -->
<template>
  <div>
    <h1>Admin Dashboard</h1>
    <p>Only admins and owners can see this</p>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'require-role',
  requireRole: ['admin', 'owner']
})
</script>
```

### Login Page

```vue
<!-- pages/signin.vue -->
<template>
  <div>
    <AuthSignIn />
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'redirect-authenticated'  // Redirect if already signed in
})
</script>
```

### Nested Route Protection

```vue
<!-- pages/admin/users.vue -->
<script setup>
definePageMeta({
  middleware: ['require-auth', 'require-role'],
  requireRole: ['admin', 'owner']
})
</script>
```

## Global Middleware

The module includes a global middleware (`auth.global.ts`) that:

- Initializes authentication state on app startup
- Handles session recovery and validation
- Manages tab synchronization for multi-tab support
- Logs authentication events (when debug mode enabled)

This middleware runs automatically - you don't need to configure it.

## Debugging Middleware

Enable debug mode to see middleware execution:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  teamAuth: {
    debug: true  // Enable debug logging
  }
})
```

Debug output shows:
- Middleware execution order
- Authentication checks
- Redirect decisions
- Role validation results

## Error Handling

### Common Errors

#### "Unknown route middleware"
```
ERROR: Unknown route middleware: 'require-auth'
```

**Solution:** Restart your dev server. Middleware registration requires a full restart.

#### Infinite Redirect Loops
If you experience redirect loops:

1. Check that `loginPage` and `redirectTo` are different routes
2. Ensure your login page doesn't have `require-auth` middleware
3. Verify environment variables are correctly set

#### Role Validation Failures
If role middleware isn't working:

1. Check user has correct role: `console.log(currentRole.value)`
2. Verify role names match exactly (case-sensitive)
3. Ensure user has completed team setup

### Custom Error Pages

Create custom error pages for middleware failures:

```vue
<!-- pages/unauthorized.vue -->
<template>
  <div>
    <h1>Access Denied</h1>
    <p>You don't have permission to access this page.</p>
    <UButton to="/">Go Home</UButton>
  </div>
</template>
```

## Advanced Usage

### Conditional Middleware

Apply middleware based on conditions:

```vue
<script setup>
const route = useRoute()
const isPublicRoute = route.path.startsWith('/public')

if (!isPublicRoute) {
  definePageMeta({
    middleware: 'require-auth'
  })
}
</script>
```

### Custom Middleware

Create your own middleware that integrates with our auth system:

```typescript
// middleware/custom-auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser, currentRole } = useTeamAuth()
  
  // Your custom logic here
  if (to.path.startsWith('/premium') && currentRole.value !== 'premium') {
    return navigateTo('/upgrade')
  }
})
```

### Middleware Chaining

Chain multiple middleware for complex requirements:

```vue
<script setup>
definePageMeta({
  middleware: [
    'require-auth',      // First: ensure authenticated
    'require-team',      // Then: ensure team member
    'custom-validation'  // Finally: custom checks
  ]
})
</script>
```

## Best Practices

1. **Use specific middleware** - Choose the most specific middleware for your needs
2. **Test redirect flows** - Verify users can complete the full auth flow
3. **Handle edge cases** - Consider what happens when teams are deleted, roles change, etc.
4. **Debug in development** - Enable debug mode during development
5. **Graceful degradation** - Provide fallbacks for auth failures

## Next Steps

- [Component Guide](./components.md) - Learn about auth components
- [Team Management](./team-management.md) - Implement team features
- [API Reference](./api/composables.md) - Explore the useTeamAuth composable
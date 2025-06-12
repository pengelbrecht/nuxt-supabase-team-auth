# Authentication & Authorization Middleware

Comprehensive middleware system for protecting routes based on authentication status, user roles, and team membership in Nuxt 3 applications.

## Overview

The middleware system provides multiple layers of protection:

1. **Global Authentication** - Automatic auth checks on every route
2. **Role-Based Access Control** - Route protection based on user roles
3. **Team Membership Verification** - Ensure users belong to teams
4. **Impersonation Controls** - Handle super admin impersonation safely
5. **Smart Redirects** - Intelligent redirection based on user state

## Quick Start

### Basic Route Protection

```vue
<!-- pages/dashboard.vue -->
<script setup>
// Require authentication
definePageMeta({
  middleware: 'require-auth'
})
</script>
```

```vue
<!-- pages/admin/index.vue -->
<script setup>
// Require admin role or higher
definePageMeta({
  middleware: ['require-auth', 'require-admin']
})
</script>
```

### Using Protection Shortcuts

```vue
<script setup>
import { protect } from '~/middleware'

// Quick protection patterns
definePageMeta(protect.dashboard()) // Auth + team required
definePageMeta(protect.teamAdmin()) // Auth + team + admin role
definePageMeta(protect.teamOwner()) // Auth + team + owner role
definePageMeta(protect.superAdmin()) // Auth + super admin role
</script>
```

## Available Middleware

### Core Middleware

#### `auth.global.ts` (Global)
Automatically runs on every route change. Handles:
- Public vs protected route detection
- Basic authentication requirements
- Team-specific route validation
- Impersonation restrictions

```typescript
// Automatically applied - no manual setup needed
```

#### `require-auth.ts`
Ensures user is authenticated, redirects to login if not.

```vue
<script setup>
definePageMeta({
  middleware: 'require-auth'
})
</script>
```

#### `require-role.ts`
Enforces role-based access control with hierarchy support.

```vue
<script setup>
// Require specific role
definePageMeta({
  middleware: 'require-admin' // or 'require-owner', 'require-super-admin'
})

// Custom role with options
definePageMeta({
  middleware: (to) => createRequireRoleMiddleware('admin', {
    redirectTo: '/dashboard',
    errorMessage: 'admin_required',
    strict: false // Allow higher roles
  })
})
</script>
```

#### `require-team.ts`
Validates team membership and team-specific route access.

```vue
<script setup>
definePageMeta({
  middleware: 'require-team'
})
</script>
```

#### `redirect-authenticated.ts`
Redirects authenticated users away from auth pages (login/signup).

```vue
<!-- pages/login.vue -->
<script setup>
definePageMeta({
  middleware: 'redirect-authenticated'
})
</script>
```

#### `impersonation.ts`
Handles impersonation security and access restrictions.

```vue
<script setup>
// Block access during impersonation
definePageMeta({
  middleware: 'block-during-impersonation'
})

// Require super admin for impersonation features
definePageMeta({
  middleware: 'require-super-admin-for-impersonation'
})
</script>
```

### Role Hierarchy

The middleware supports role hierarchy:
- **super_admin** (Level 4) - Highest privileges
- **owner** (Level 3) - Team ownership
- **admin** (Level 2) - Team administration  
- **member** (Level 1) - Basic team access

Higher roles inherit permissions from lower roles unless `strict: true` is used.

## Middleware Combinations

### Pre-defined Combinations

```typescript
import { middlewareCombinations } from '~/middleware'

// Available combinations:
middlewareCombinations.public          // ['redirect-authenticated']
middlewareCombinations.protected       // ['require-auth']
middlewareCombinations.dashboard       // ['require-auth', 'require-team']
middlewareCombinations.teamAdmin       // ['require-auth', 'require-team', 'require-admin']
middlewareCombinations.teamOwner       // ['require-auth', 'require-team', 'require-owner']
middlewareCombinations.superAdmin      // ['require-auth', 'require-super-admin']
middlewareCombinations.impersonation   // ['require-auth', 'require-super-admin-for-impersonation']
middlewareCombinations.sensitive       // ['require-auth', 'require-team', 'block-during-impersonation']
```

### Using Combinations

```vue
<script setup>
import { getMiddlewareForRoute } from '~/middleware'

// Get middleware array for specific protection level
definePageMeta({
  middleware: getMiddlewareForRoute('teamAdmin')
})
</script>
```

## Advanced Usage

### Custom Role Middleware

```typescript
import { createRequireRoleMiddleware } from '~/middleware'

// Create custom role middleware
const requireManagerRole = createRequireRoleMiddleware('admin', {
  redirectTo: '/team/dashboard',
  errorMessage: 'manager_access_required',
  strict: false
})

export default requireManagerRole
```

### Custom Team Access

```typescript
import { createTeamAccessMiddleware } from '~/middleware'

// Validate team membership via API
const strictTeamAccess = createTeamAccessMiddleware({
  validateMembership: true,
  redirectTo: '/teams',
  errorMessage: 'team_access_denied'
})
```

### Dynamic Middleware

```vue
<script setup>
// Dynamic role based on route meta
definePageMeta({
  requireRole: 'admin', // This gets picked up by require-role middleware
  middleware: 'require-role'
})
</script>
```

### Conditional Redirects

```typescript
import { createRedirectAuthenticated } from '~/middleware'

// Custom redirect logic
const smartRedirect = createRedirectAuthenticated(
  (user, team) => {
    if (team) return '/dashboard'
    if (user.isNewUser) return '/onboarding'
    return '/teams'
  },
  (user, team, route) => {
    // Only redirect if coming from specific pages
    return ['/login', '/signup'].includes(route.path)
  }
)
```

## Route Examples

### Public Marketing Page

```vue
<!-- pages/index.vue -->
<script setup>
definePageMeta(protect.public())
</script>
```

### User Dashboard

```vue
<!-- pages/dashboard.vue -->
<script setup>
definePageMeta(protect.dashboard())
</script>
```

### Team Admin Panel

```vue
<!-- pages/team/admin/index.vue -->
<script setup>
definePageMeta(protect.teamAdmin())
</script>
```

### Owner-Only Settings

```vue
<!-- pages/team/settings/delete.vue -->
<script setup>
definePageMeta(protect.teamOwner())
</script>
```

### Super Admin Panel

```vue
<!-- pages/admin/index.vue -->
<script setup>
definePageMeta(protect.superAdmin())
</script>
```

### Impersonation Control

```vue
<!-- pages/admin/impersonate.vue -->
<script setup>
definePageMeta(protect.impersonation())
</script>
```

### Sensitive Operations

```vue
<!-- pages/billing/index.vue -->
<script setup>
// Blocked during impersonation
definePageMeta(protect.sensitive())
</script>
```

## Team-Specific Routes

### Route Parameters

```vue
<!-- pages/teams/[teamId]/dashboard.vue -->
<script setup>
definePageMeta({
  middleware: ['require-auth', 'require-team']
})
// Middleware automatically validates teamId matches user's current team
</script>
```

### Multi-Team Support

```vue
<!-- pages/teams/[teamId]/switch.vue -->
<script setup>
import { createTeamAccessMiddleware } from '~/middleware'

definePageMeta({
  middleware: [
    'require-auth',
    createTeamAccessMiddleware({ allowAnyTeam: true })
  ]
})
</script>
```

## Error Handling

### Error Parameters

Middleware adds error parameters to redirect URLs:

- `insufficient_permissions` - User lacks required role
- `team_access_denied` - User not member of required team  
- `select_team_first` - User needs to select a team
- `admin_blocked_during_impersonation` - Admin route blocked during impersonation
- `super_admin_required` - Super admin access required

### Custom Error Messages

```vue
<!-- pages/dashboard.vue -->
<script setup>
const route = useRoute()
const error = route.query.error

// Handle specific errors
if (error === 'insufficient_permissions') {
  // Show permission denied message
}
</script>
```

## Security Considerations

### Impersonation Safety

- Admin routes automatically blocked during impersonation
- Dangerous operations (delete, billing) blocked during impersonation
- Only super admins can start impersonation
- Impersonation sessions are time-limited

### Team Validation

- Route team IDs validated against user's current team
- Cross-team access automatically denied
- Team membership validated on sensitive operations

### Authentication State

- Middleware waits for auth state to load before making decisions
- Handles loading states gracefully
- Supports server-side rendering

## Performance

### Optimization Features

- Global middleware skipped on server-side for performance
- Auth state loading has timeout protection
- Middleware execution is efficient and cached
- Minimal API calls during route changes

### Best Practices

1. Use global middleware for broad protection
2. Combine specific middleware for granular control
3. Leverage pre-defined combinations for common patterns
4. Use custom factories for reusable logic
5. Handle loading states in components

## Testing

The middleware includes comprehensive test coverage. See `tests/middleware/` for examples of:

- Authentication flow testing
- Role hierarchy validation
- Team access verification
- Impersonation security testing
- Error condition handling

## Migration Guide

When upgrading or migrating existing routes:

1. Replace manual auth checks with middleware
2. Use protection shortcuts for cleaner code
3. Leverage role hierarchy instead of exact role matching
4. Update redirect logic to use smart redirects
5. Add impersonation safety to sensitive routes

## Troubleshooting

### Common Issues

1. **Infinite redirect loops**: Check public route configuration
2. **Auth state not loading**: Verify useTeamAuth is properly initialized
3. **Team validation failing**: Ensure user has current team set
4. **Role checks failing**: Verify role hierarchy configuration

### Debug Mode

Enable debug logging:

```typescript
// In middleware
console.log('Auth state:', { currentUser, currentRole, currentTeam })
```

### Performance Issues

- Check middleware timeout values
- Verify auth state loading efficiency
- Monitor API call frequency during navigation
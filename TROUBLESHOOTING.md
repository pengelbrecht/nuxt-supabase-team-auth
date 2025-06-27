# Troubleshooting Guide

## Common Issues and Solutions

### "useState is not defined" Error
**Fixed in v0.1.8** - The module now properly imports `useState` from `#app`.

If you're still seeing this error:
1. Update to `nuxt-supabase-team-auth@0.1.8` or later
2. Clear your `.nuxt` cache: `rm -rf .nuxt`
3. Restart your dev server

### "TeamAuthUserButton component not found"
The correct component name is `UserButton`, not `TeamAuthUserButton`.

```vue
<!-- ✅ Correct -->
<UserButton />

<!-- ❌ Incorrect -->
<TeamAuthUserButton />
```

### Supabase Server Configuration Missing
**Fixed in v0.1.8** - The module now auto-detects service role keys from common environment variables.

Required environment variables:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For server operations
```

### ESM/CJS Module Conflicts with postgrest-js
**Fixed in v0.2.3** - The module now forces all Supabase packages to be external to prevent Vite from bundling them.

The module automatically configures:
- `vite.optimizeDeps.exclude` for all Supabase packages
- `vite.ssr.external` to force Supabase packages to be handled by Node.js
- Only transpiles the module itself, not Supabase dependencies

This approach prevents the "does not provide an export named 'default'" error by letting Node.js handle Supabase package imports directly.

If you're still seeing import errors with v0.2.3+, please report it as a bug with your package.json dependencies. For older versions, you can manually add to your `nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      exclude: ['@supabase/supabase-js', '@supabase/postgrest-js', '@supabase/storage-js', '@supabase/realtime-js']
    },
    ssr: {
      external: ['@supabase/supabase-js', '@supabase/postgrest-js', '@supabase/storage-js', '@supabase/realtime-js'],
      noExternal: ['nuxt-supabase-team-auth']
    }
  }
})
```

### UDropdown Component Not Found
This indicates `@nuxt/ui` is not properly installed or configured.

1. Install Nuxt UI:
```bash
npm install @nuxt/ui
```

2. Add to your `nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-supabase-team-auth'
  ]
})
```

### Component Import Issues

If components like `SignedIn`, `SignedOut`, or `UserButton` are not being recognized:

1. Ensure `@nuxt/ui` is installed and added to your modules:
   ```typescript
   export default defineNuxtConfig({
     modules: ['@nuxt/ui', 'nuxt-supabase-team-auth']
   })
   ```

2. Components are auto-imported, no manual imports needed

3. **If components still aren't recognized after v0.2.0:**
   - Clear the `.nuxt` directory: `rm -rf .nuxt`
   - Restart your dev server
   - Check `.nuxt/types/components.d.ts` to verify components are registered

4. **For v0.2.1+**, components are globally registered with transpilation enabled for better compatibility

### Available Components
All components are auto-imported when the module is installed:

- `SignedIn` / `SignedOut` - Conditional rendering based on auth state
- `UserButton` - User avatar with dropdown menu
- `AuthSignIn` - Sign-in form
- `AuthSignUpWithTeam` - Sign-up with team creation
- `TeamForm` - Team management form  
- `TeamMembersDialog` - Team member management
- `ProfileForm` - User profile editing
- `ImpersonationBanner` - Shows when impersonating users
- And many more...

### Configuration Example

Complete `nuxt.config.ts` example:
```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-supabase-team-auth'
  ],
  
  teamAuth: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    redirectTo: '/dashboard'
  }
})
```

### Still Having Issues?
1. Check the console for specific error messages
2. Ensure all environment variables are set
3. Update to the latest version: `npm update nuxt-supabase-team-auth`
4. Clear caches: `rm -rf .nuxt node_modules/.cache`
5. Report issues at: https://github.com/pengelbrecht/nuxt-supabase-team-auth/issues
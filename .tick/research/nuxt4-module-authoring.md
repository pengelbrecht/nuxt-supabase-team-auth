# Nuxt 4 Module Authoring Research

## Executive Summary

This document analyzes the `nuxt-supabase-team-auth` module implementation against Nuxt 4 compatibility requirements.

**Current Module Setup:**
- `@nuxt/kit`: ^3.13.0 (installed: 3.17.6)
- `nuxt` (dev): ^3.13.0
- Compatibility declared: `^3.0.0`

---

## 1. @nuxt/kit API Analysis

### 1.1 APIs Currently Used in `src/module.ts`

| API | Current Usage | Nuxt 4 Status |
|-----|---------------|---------------|
| `defineNuxtModule` | Module definition | **Stable** - No changes expected |
| `createResolver` | Path resolution | **Stable** - No changes expected |
| `addImports` | Auto-import composables | **Stable** - No changes expected |
| `addComponentsDir` | Component registration | **Review needed** - Options may change |
| `installModule` | Installing @nuxt/ui and @nuxtjs/supabase | **Stable** - No changes expected |
| `defu` | Config merging | **Stable** - Standalone package |

### 1.2 Hooks Currently Used

| Hook | Purpose | Nuxt 4 Status |
|------|---------|---------------|
| `modules:before` | Supabase config setup | **Stable** |
| `app:resolve` | Middleware registration | **Review needed** |
| `nitro:config` | Server route handlers | **Review needed** |
| `pages:extend` | Page registration | **Stable** |
| `prepare:types` | Type declarations | **Stable** |

---

## 2. Module Definition Review

### 2.1 Compatibility Declaration Needs Update

```typescript
// Current (line 68-70)
compatibility: {
  nuxt: '^3.0.0',  // Should become '>=3.0.0' or '^3.0.0 || ^4.0.0'
}
```

### 2.2 Runtime Config Patterns

Current usage:
```typescript
nuxt.options.runtimeConfig = defu(nuxt.options.runtimeConfig, { ... })
nuxt.options.runtimeConfig.public = defu(nuxt.options.runtimeConfig.public, { ... })
```

**Status:** This pattern is stable and should continue working in Nuxt 4.

---

## 3. Runtime Directory Conventions

### 3.1 Current Structure

```
src/runtime/
  components/      # Vue components
  composables/     # Composables (auto-imported)
  middleware/      # Route middleware
  pages/           # Module-provided pages
  server/          # Server routes (api/, utils/)
  types/           # TypeScript types
  assets/          # CSS assets
  utils/           # Shared utilities
```

### 3.2 Nuxt 4 Changes

**Known changes in Nuxt 4:**
1. **New `shared/` directory** - For code shared between client and server
2. **`utils/` auto-import changes** - May affect how utilities are exported
3. **Server directory conventions** - Nitro 3 may have different patterns

---

## 4. Composable Auto-Import Changes

### 4.1 Current Implementation

```typescript
addImports([
  { name: 'useTeamAuth', from: resolver.resolve('./runtime/composables/useTeamAuth') },
  { name: 'useSession', from: resolver.resolve('./runtime/composables/useSession') },
  { name: 'useTeamAuthConfig', from: resolver.resolve('./runtime/composables/useTeamAuthConfig') },
  { name: 'usePasswordPolicy', from: resolver.resolve('./runtime/composables/usePasswordPolicy') },
])
```

**Status:** This explicit registration pattern is stable and recommended.

### 4.2 Internal Composable Imports

The module uses wrapper composables in `useSupabaseComposables.ts`:
```typescript
import { useNuxtApp, useState } from '#app'
```

**Potential Issue:** Nuxt 4 may change `#app` alias behavior. Consider switching to `#imports`.

---

## 5. Server Route Compatibility

### 5.1 Current Registration Pattern

```typescript
nuxt.hook('nitro:config', (nitroConfig) => {
  nitroConfig.handlers = nitroConfig.handlers || []
  apiEndpoints.forEach((endpoint) => {
    nitroConfig.handlers.push({
      route: `/api/${endpoint}`,
      method: 'post',
      handler: resolver.resolve(`./runtime/server/api/${endpoint}.post`),
    })
  })
})
```

### 5.2 Server Route Implementation

Current server routes use h3 utilities:
```typescript
import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
```

**Status:** h3 utilities are stable. Monitor for Nitro 3 changes.

---

## 6. Middleware Compatibility

### 6.1 Current Registration

```typescript
nuxt.hook('app:resolve', (app) => {
  app.middleware.push({
    name: 'auth',
    path: resolver.resolve('./runtime/middleware/auth.global'),
    global: true,
  })
})
```

**Status:** This pattern is stable. Monitor for middleware execution order changes.

---

## 7. Action Items Summary

### High Priority (Before Nuxt 4 Release)

1. **Update compatibility version**
   - File: `src/module.ts`
   - Change: `nuxt: '^3.0.0'` -> `nuxt: '>=3.0.0'`

2. **Test with Nuxt 4 beta/RC**
   - Run full test suite against Nuxt 4 preview releases
   - Document any breaking changes encountered

3. **Review `#app` imports**
   - File: `src/runtime/composables/useSupabaseComposables.ts`
   - May need to switch to `#imports` for consistency

### Medium Priority

4. **Verify server route registration**
   - Test that `nitro:config` hook behavior is unchanged
   - Verify handler resolution works correctly

5. **Review component auto-imports**
   - Test component tree-shaking behavior
   - Verify no duplicate registrations

6. **Test middleware execution**
   - Verify global middleware runs in expected order
   - Test SSR vs client behavior

### Low Priority

7. **Consider shared directory**
   - Evaluate if any utilities should use new `shared/` convention

8. **Review build optimizations**
   - Test if `transpile` options are still needed

---

## 8. Risk Assessment

### Low Risk
- `defineNuxtModule`, `createResolver`, `addImports` usage
- Runtime config patterns with `defu`
- Page registration via `pages:extend`

### Medium Risk
- Component directory registration options
- Server route handler registration via `nitro:config`
- `#app` vs `#imports` alias changes

### High Risk (need testing)
- Middleware execution order changes
- SSR hydration behavior changes
- Nitro 3 server utilities compatibility

---

## 9. Dependencies to Watch

| Package | Current | Notes |
|---------|---------|-------|
| `@nuxt/kit` | ^3.13.0 (installed: 3.17.6) | Will need ^4.0.0 |
| `@nuxtjs/supabase` | 1.5.3 | Monitor for Nuxt 4 update |
| `@nuxt/ui` | ^3.0.0 (peer) | Monitor for Nuxt 4 update |

---

## 10. Testing Checklist

```bash
# Test commands to run against Nuxt 4
pnpm run build          # Module builds successfully
pnpm run dev            # Playground works
pnpm run test           # Unit tests pass
pnpm run test:types     # TypeScript checks pass
```

**Manual testing:**
- [ ] Sign up flow works
- [ ] Sign in flow works
- [ ] OAuth flows work
- [ ] Middleware protection works
- [ ] Server routes respond correctly
- [ ] Components render properly
- [ ] SSR works correctly
- [ ] Impersonation works

---

*Document created: 2026-01-26*

# @nuxtjs/supabase 2.0 Breaking Changes Research

## Overview

**Current version**: 1.5.3
**Target version**: 2.0.x
**Research date**: 2026-01-26

## Current Module Usage Analysis

### Composables Used in nuxt-supabase-team-auth

Based on analysis of `/src/runtime/composables/`:

1. **useSupabaseClient** - Custom wrapper accessing `nuxtApp.$supabase.client`
2. **useSupabaseSession** - Custom wrapper using `useState('supabase_session')`
3. **useSupabaseUser** - Custom wrapper using `useState('supabase_user')`

The module creates custom wrapper composables in `/src/runtime/composables/useSupabaseComposables.ts` rather than using auto-imported composables directly because auto-imports via `#imports` don't work in published npm modules.

### How the Current Version (1.5.3) Works

#### Client Plugin
- Uses `@supabase/ssr` for browser client with `createBrowserClient`
- Provides `$supabase` with `{ client }` structure
- Auth state management via `onAuthStateChange`

#### Server Plugin
- Uses `createServerClient` from `@supabase/ssr`
- Creates SSR-compatible server client with cookie handlers

#### Module Configuration
Key configuration options in 1.5.3:
- `url` / `key` - Supabase credentials
- `redirect` - Enable automatic redirects (default: true)
- `redirectOptions` - Login, callback, exclude paths
- `useSsrCookies` - Enable SSR cookie support (default: true)
- `cookieOptions` - Cookie settings
- `clientOptions` - SupabaseClientOptions

### nuxt-supabase-team-auth Module Setup

From `/src/module.ts`, the module installs @nuxtjs/supabase with:
- `useSsrCookies: true`
- `clientOptions.auth.flowType: 'implicit'` (for inviteUserByEmail)
- `clientOptions.auth.detectSessionInUrl: true`
- `redirectOptions` for public/protected mode handling

## Deprecated Options Already in 1.5.3

Found in the module:
1. `cookieName` - deprecated, use `cookiePrefix` instead
2. `redirectOptions.cookieRedirect` - deprecated, use `saveRedirectToCookie` instead

## Expected Breaking Changes in 2.0.x

### 1. Composable API Changes

| Composable | 1.5.3 Behavior | Potential 2.0 Changes |
|------------|----------------|----------------------|
| `useSupabaseClient()` | Returns `nuxtApp.$supabase.client` | May change client structure |
| `useSupabaseUser()` | Returns `Ref<User \| null>` | Possible type refinements |
| `useSupabaseSession()` | Returns `Ref<Session without user>` | Session handling may change |

### 2. Server-Side Changes

Current server utilities should remain stable:
- `serverSupabaseClient(event)`
- `serverSupabaseServiceRole(event)`
- `serverSupabaseUser(event)`
- `serverSupabaseSession(event)`

## Impact Assessment for nuxt-supabase-team-auth

### Low Risk Areas
1. **Custom Wrapper Composables** - insulated from composable signature changes
2. **Server-Side Code** - uses standard patterns

### Medium Risk Areas
1. **Plugin Initialization** - reliance on `nuxtApp.$supabase.client`
2. **Auth State Management** - `onAuthStateChange` usage
3. **SSR Cookie Handling** - session persistence

### High Risk Areas
1. **Module Configuration** - `installModule` options may change
2. **Redirect Options** - `login: false` pattern
3. **Client Options** - `flowType` and `detectSessionInUrl`

## Migration Checklist

### Pre-Migration
- [ ] Review official changelog and migration guide
- [ ] Check GitHub issues for migration problems
- [ ] Back up current working configuration

### Configuration Updates
- [ ] Update `cookieName` to `cookiePrefix`
- [ ] Update `cookieRedirect` to `saveRedirectToCookie`
- [ ] Verify redirect configuration
- [ ] Test SSR cookie handling

### Composable Updates
- [ ] Verify `$supabase.client` access pattern
- [ ] Test `useState` keys for session and user
- [ ] Confirm `onAuthStateChange` behavior

### Testing
- [ ] Sign up flow
- [ ] Sign in flow
- [ ] OAuth (Google) callback
- [ ] Invitation acceptance
- [ ] Impersonation
- [ ] SSR page loads
- [ ] Page refresh session persistence

## Files That May Need Updates

- `/src/runtime/composables/useSupabaseComposables.ts`
- `/src/module.ts` (module installation options)
- `/src/runtime/middleware/auth.global.ts`
- `/src/runtime/pages/auth/callback.vue`

## Resources

- Official docs: https://supabase.nuxtjs.org
- GitHub repo: https://github.com/nuxt-modules/supabase
- Changelog: https://supabase.nuxtjs.org/changelog

---

*Note: This document is based on code analysis. Actual 2.0 changes should be verified against official release notes.*

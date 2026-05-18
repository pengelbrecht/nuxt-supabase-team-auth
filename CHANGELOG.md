# Changelog

All notable changes to this project will be documented in this file.

## [0.7.7] - 2026-05-18

### 🐛 Bug Fixes

- **Fix hard-nav redirect for authenticated users (gh#52)** — The global auth middleware (`auth.global.ts`) could redirect a signed-in user to `/login` on a hard navigation into a protected route. The wait loop in the middleware broke out as soon as `currentUser.value !== undefined`, but `currentUser` starts as `null` during hydration on a hard nav — so the check fired on the first tick before the session restore had completed. The loop now polls `isLoading` only, letting the 2-second safety timeout do its job. Most commonly observed when landing on a deep protected URL from an email link, bookmark, or pasted URL.

### 🔧 Technical Changes

- Bump `@nuxtjs/supabase` floor from `^2.0.0` to `^2.0.7` so consumers automatically pick up upstream PR #594, which restores session + user claims before middlewares run in SPA mode.

### ⚠️ Known Limitations (upstream)

A few related races still exist in `@nuxtjs/supabase` itself and are outside this module's control:

- **[nuxt-modules/supabase#611](https://github.com/nuxt-modules/supabase/issues/611)** — `useSupabaseUser()` can still return `null` in middlewares on refresh when `ssr: false` *and* `useSsrCookies: true` (the default). Affects pure-SPA setups that also use server-side auth APIs.
- **[nuxt-modules/supabase#605](https://github.com/nuxt-modules/supabase/issues/605)** — The same combo silently breaks SPA refresh and isn't documented upstream.
- **[nuxt-modules/supabase#606](https://github.com/nuxt-modules/supabase/issues/606)** — `page:start await getClaims()` can hang every navigation when the JWKS fetch stalls.

If you hit one of these, watch those upstream issues for a fix rather than filing here.

## [0.5.4] - 2025-09-15

### 🐛 Bug Fixes

- **Fixed module pages node_modules compatibility** - Made all implicit imports explicit in module pages (accept-invite, auth/confirm, auth/callback, auth/forgot-password)
- **Restored definePageMeta functionality** - Properly import and use `definePageMeta` and `defineOptions` instead of removing them
- **Enhanced page import reliability** - All module pages now work correctly when installed in node_modules with explicit imports from `#imports`

## [0.5.3] - 2025-09-12

### 🐛 Bug Fixes

- **Fixed module page compatibility** - Removed `definePageMeta` and `defineOptions` from accept-invite page to ensure proper functionality when installed in node_modules
- **Improved module page architecture** - Module pages now work correctly without relying on Nuxt auto-imports that aren't available in node_modules

## [0.5.2] - 2025-08-29

### 🐛 Bug Fixes

- **Fixed Cloudflare Workers compatibility** - Replaced `jsonwebtoken` with `jose` library to resolve `superCtor.prototype` runtime errors in Cloudflare Workers environment
- **Improved edge runtime support** - The module now works seamlessly in modern edge runtimes including Cloudflare Workers, Vercel Edge Runtime, and Deno Deploy

### 🔧 Technical Changes

- Replace `jsonwebtoken ^9.0.2` with `jose ^5.9.6` for better web standards compliance
- Update JWT signing logic in impersonation endpoints to use `jose.SignJWT`
- Update JWT verification logic to use `jose.jwtVerify`
- Remove `@types/jsonwebtoken` dev dependency
- Maintain identical JWT functionality while improving runtime compatibility

## [0.4.0] - 2025-07-02

### 🎉 First Stable Release

This is the first stable release of `nuxt-supabase-team-auth` with all critical bugs resolved.

### 🐛 Bug Fixes

- **Fixed Team Members dialog not opening from UserButton dropdown** - Resolved component unmounting issue during loading states
- **Fixed authentication state management** - Prevents UI from unmounting during data loading operations
- **Stabilized dialog/modal system** - All dialogs now work consistently across the application

### ✨ Features

- Complete team-based authentication system for Nuxt 3
- Supabase integration with RLS policies
- Role-based access control (owner, admin, member, super_admin)
- Team management UI components
- User profile management
- Team invitations system
- Impersonation support for super admins
- CLI tool for database setup and migrations
- Full TypeScript support

### 🔧 Technical Improvements

- Comprehensive test suite with 126+ tests
- Proper error handling throughout
- Consistent component patterns
- Clean module architecture
- Extensive documentation in CLAUDE.md

### 📝 Notes

All previous versions (0.1.x - 0.3.x) were development/debug releases and should not be used in production.
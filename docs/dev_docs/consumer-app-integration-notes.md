# Consumer App Integration Notes

This document tracks our findings, issues, and solutions when integrating the nuxt-supabase-team-auth module into consumer applications.

## Current Status: Task 36 - Package as Distributable Nuxt Module

### ✅ SUCCESS: Server Routes Working!
**Updated**: After adding proper Supabase environment configuration, server routes are properly registered and accessible:
- Routes respond to POST requests
- Auth validation working (401 for unauthorized)
- Module API endpoints fully functional in consumer app

### Critical Requirement: Environment Configuration
**Consumer apps MUST have Supabase configuration** in `.env` file:
```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Without this, server routes fail with "undefined/functions/v1/..." errors.

### Issues Discovered During Integration

#### 1. Component Resolution Issues (RESOLVED)
**Problem**: Consumer app was using low-level Nuxt UI components instead of our module's high-level components.

**Root Cause**: Test page was manually implementing auth UI with `UCard`, `UModal`, `UFormField` instead of using our `AuthSignIn`, `AuthSignUpWithTeam`, `UserButton` components.

**Solution**: Rewrote consumer app to properly showcase module components:
- Use `UserButton`, `SignedIn/SignedOut`, `AuthSignIn`, `AuthSignUpWithTeam`
- Use `useTeamAuth()` composable for auth state
- Remove manual UI reconstruction

#### 2. Nuxt UI v2 vs v3 Component Names (RESOLVED)
**Problem**: `UFormGroup` component not found.

**Root Cause**: `UFormGroup` is Nuxt UI v2 component name, renamed to `UFormField` in v3.

**Solution**: Updated all references from `UFormGroup` to `UFormField`.

#### 3. Module Plugin Path Resolution Issues (ONGOING)
**Problem**: Build errors with plugin paths not resolving correctly.

**Error Messages**:
```
Failed to resolve import "/Users/.../dist/runtime/plugins/supabase.client.ts" 
ENOENT: no such file or directory
```

**Root Cause**: Module build is generating `.js` files but module is referencing `.ts` extensions in plugin registration.

**Attempted Solutions**:
- Added `installModule('@nuxt/ui')` to ensure proper dependency loading
- Modified module to auto-install Nuxt UI if not present

#### 4. Built Module vs Source Module Issue (CRITICAL - INVESTIGATING)
**Problem**: Consumer app (using built module) fails where playground (using source) works.

**Key Difference**:
- **Playground**: `'../src/module.ts'` (source) → WORKS ✅
- **Consumer App**: `'nuxt-supabase-team-auth'` (built dist) → FAILS ❌

**Same Plugin Loading Order**: Both have identical plugin loading order (our plugins → Nuxt UI), but playground doesn't have context injection errors.

**Hypothesis**: Issue isn't plugin order but **module build process** or **component resolution** in the built distribution.

**Evidence**: Plugin loading order identical in both:
```bash
# Both playground AND consumer app:
line 21-22: Our Supabase plugins  
line 23+: Nuxt UI plugins
```

## 🔍 Research Findings & Hypotheses

### Critical Discovery: Missing UApp Wrapper
**Source**: Found exact error `Symbol(nuxt-ui.locale-context)` not found in Nuxt UI documentation
**Solution**: Nuxt UI v3 requires `<UApp>` wrapper to provide locale context

### Key Insight: Published vs Source Module Differences
**From Nuxt docs**: "Published modules lose auto-import capabilities" and "Auto-imports are not enabled for files within node_modules"

## 🧪 Testable Hypotheses (Priority Order)

### Hypothesis 1: Missing UApp Context Provider (DISPROVEN ❌)
**Problem**: Consumer app missing `<UApp>` wrapper that provides `Symbol(nuxt-ui.locale-context)`
**Test**: ✅ Added `<UApp>` wrapper to consumer app's app.vue
**Result**: ❌ Still unstyled with hydration errors
**Status**: DISPROVEN - UApp didn't fix the issue

**NEW ERROR**: `Hydration node mismatch: rendered on server vs expected on client` 
**Analysis**: This suggests server/client rendering differences, not just context missing

**PARTIAL SUCCESS**: ✅ UApp DID remove server warnings about `Symbol(nuxt-ui.locale-context)`
**REMAINING ISSUE**: Still unstyled + hydration errors

### ROOT CAUSE IDENTIFIED: Missing CSS Import  
**Discovery**: Playground has `@import "@nuxt/ui";` in main.css, consumer app missing this
**Fix Applied**: Added main.css with `@import "@nuxt/ui";` (removed tailwindcss import - not needed)

### Status Update: Testing Dependencies Fix
1. **UApp wrapper** in app.vue ✅ (fixed locale context warnings)
2. **CSS imports** for Tailwind + Nuxt UI ✅ (added both imports)  
3. **Missing dependencies** ✅ (installed @nuxt/ui and tailwindcss)
4. **Module order** (`@nuxt/ui` before our module) ✅
5. **Environment config** (.env file) ✅

### ✅ ROOT CAUSE CONFIRMED: Missing @nuxt/ui Dependency
**Problem**: Consumer app was missing @nuxt/ui dependency (Tailwind comes with Nuxt UI)
**Solution**: Added @nuxt/ui dependency + CSS import
**Status**: RESOLVED - styling now works correctly!

**Minimal Requirements for Consumer Apps**:
1. Install `@nuxt/ui` dependency (includes Tailwind CSS)
2. Add CSS import: `@import "@nuxt/ui";`
3. Include `<UApp>` wrapper in app.vue
4. Add Supabase environment configuration (.env file)

**Note**: Module order does NOT matter - Nuxt handles plugin loading correctly regardless of module order.

### ✅ FINAL FIX: SSR Hydration Mismatch Resolved
**Problem**: UserButton Avatar component had SSR hydration mismatch due to auth state differences
**Root Cause**: `currentUser` and `currentProfile` are `null` during SSR but populated on client
**Solution**: Wrapped UAvatar in `<ClientOnly>` with SSR fallback to ensure consistent rendering
**Status**: COMPLETE - both styling and hydration warnings resolved!

### Hypothesis 2: CSS Not Loading in Built Module (MEDIUM CONFIDENCE)  
**Problem**: CSS from our module components not properly bundled/loaded
**Test**: Check if Nuxt UI styles load, inspect computed styles on components
**Expected**: Components have no styling even with context fixed
**Time**: 5 minutes

### Hypothesis 3: Component Import Path Issues (MEDIUM CONFIDENCE)
**Problem**: Built components can't resolve Nuxt UI imports properly
**Test**: Compare import statements in source vs built components  
**Expected**: Different import paths between source/dist versions
**Time**: 10 minutes

### Hypothesis 4: Plugin Initialization Order (LOW CONFIDENCE - DISPROVEN)
**Problem**: ~~Plugin loading order~~
**Status**: DISPROVEN - playground has same order but works
**Time**: N/A

## 🎯 Testing Plan

### Phase 1: Quick Wins (5 minutes)
1. **Test H1**: Add `<UApp>` wrapper to consumer app
2. **Verify**: Check if context errors disappear
3. **Assess**: Styling still broken or fully resolved?

### Phase 2: Deep Diagnosis (15 minutes)
1. **CSS Loading**: Compare CSS in playground vs consumer network tab
2. **Component Analysis**: Inspect built component imports vs source
3. **Module Structure**: Verify CSS injection in module.ts

### Phase 3: Fix Implementation (30 minutes)
1. **Apply Solutions**: Based on confirmed hypotheses
2. **Test Distribution**: Rebuild and verify fixes
3. **Document**: Update integration requirements

## 📋 Likely Required Changes

### Consumer App Requirements:
```vue
<!-- app.vue -->
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

### Module Fixes (if needed):
- Ensure CSS properly bundled via module setup
- Fix component import paths for distribution
- Add explicit `<UApp>` requirement to documentation

## Current Architecture

### Package Structure
```
nuxt-supabase-team-auth/
├── src/module.ts              # Main module definition
├── src/runtime/               # Runtime code (components, composables, etc.)
├── dist/                      # Built module files
└── test-projects/
    └── consumer-app/          # Test consumer application
```

### Module Dependencies
- **Required Dependencies**: Consumer must explicitly install and configure `@nuxt/ui`, `@nuxt/icon`
- **Auto-Installation Doesn't Work**: Module auto-install fails to properly initialize context providers

### Consumer App Configuration
```typescript
// nuxt.config.ts  
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-supabase-team-auth'], // ⚠️ ORDER MATTERS!
  teamAuth: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    redirectTo: '/dashboard',
    debug: true
  }
})
```

### Critical Module Loading Order
1. **@nuxt/ui MUST be listed first** - initializes context providers
2. **nuxt-supabase-team-auth second** - depends on UI framework being ready
3. **Environment config required** - copy .env from playground for local development

## Module Usage Patterns

### Correct Component Usage
```vue
<template>
  <!-- High-level module components -->
  <UserButton />
  
  <SignedOut>
    <AuthSignIn @signed-in="handleSignedIn" />
    <AuthSignUpWithTeam @signed-up="handleSignedUp" />
  </SignedOut>
  
  <SignedIn>
    <!-- Team management UI -->
  </SignedIn>
</template>

<script setup>
const { currentUser, currentTeam, currentRole, signOut } = useTeamAuth()
</script>
```

### Incorrect Usage (Anti-pattern)
```vue
<!-- Don't manually rebuild auth UI with low-level components -->
<UModal v-model="showSignIn">
  <UCard>
    <UFormField label="Email">
      <UInput v-model="email" />
    </UFormField>
  </UCard>
</UModal>
```

## Debugging Tools

### Generated Type Files (Consumer App)
- `.nuxt/nuxt.d.ts` - Shows module type references
- `.nuxt/components.d.ts` - Lists available components
- `.nuxt/types/plugins.d.ts` - Shows loaded plugins

### Key Observations
1. Module types are properly registered (`/// <reference types="nuxt-supabase-team-auth" />`)
2. Nuxt UI types are loaded (`/// <reference types="@nuxt/ui" />`)
3. Nuxt UI plugins are loading (color-mode, icon plugins visible)
4. Our module's plugins are NOT loading (missing from plugins.d.ts)

## Next Steps

### Immediate Issues to Fix
1. **Plugin Path Resolution**: Fix `.ts` vs `.js` extension issues in built module
2. **Plugin Loading**: Ensure our Supabase plugins load correctly
3. **Nuxt UI Context**: Resolve context provider initialization

### Module Architecture Decisions
1. **Dependency Strategy**: Stick with peer dependencies + auto-install approach
2. **Component Strategy**: High-level components only, no low-level UI exposure
3. **Documentation**: Clear examples of correct vs incorrect usage patterns

## Testing Strategy

### Consumer App Test Cases
- [ ] Module components render correctly
- [ ] Authentication flow works end-to-end
- [ ] No console errors or warnings
- [ ] Proper styling (CSS loading)
- [ ] SSR/hydration works correctly

### Dependency Scenarios
- [ ] Consumer has no UI framework (auto-install Nuxt UI)
- [ ] Consumer has Nuxt UI v3 (use existing)
- [ ] Consumer has conflicting UI framework (document limitations)

## Lessons Learned

1. **Component Philosophy**: Modules should provide high-level abstractions, not expose low-level building blocks
2. **Dependency Management**: Peer dependencies with auto-install fallback provides best UX
3. **Testing Requirements**: Need dedicated consumer app to test real-world integration
4. **Build Process**: Module build needs to match runtime expectations for file extensions
5. **Plugin Loading Order**: Module plugins must load after dependency plugins (Nuxt UI)
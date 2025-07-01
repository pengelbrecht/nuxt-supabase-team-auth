# Nuxt Module Dependencies - Complete Implementation Guide

**Based on Real-World Experience and Official Nuxt Documentation**

## 🚨 Critical Rule: Published Modules Cannot Use Auto-Imports

**THE FUNDAMENTAL ISSUE**: Published Nuxt modules (installed from npm) cannot rely on auto-imports like local development can. Everything must be explicitly imported.

### Why Auto-Imports Fail in Published Modules

```typescript
// ❌ FAILS in published modules (installed from npm)
const user = useSupabaseUser()        // "useSupabaseUser is not defined"
const router = useRouter()            // "useRouter is not defined" 
const toast = useToast()              // "useToast is not defined"
navigateTo('/dashboard')              // "navigateTo is not defined"

// ✅ WORKS in published modules - explicit imports
import { useRouter, navigateTo, useToast } from '#imports'
import { ref, computed, onMounted } from 'vue'
```

**Root Cause**: Auto-imports are a build-time optimization that doesn't work when code is pre-compiled in `node_modules`.

## Core Import Patterns for Published Modules

### 1. All Nuxt Utilities from `#imports`

```typescript
// ✅ CORRECT - All Nuxt utilities from #imports
import { 
  defineNuxtRouteMiddleware,
  navigateTo,
  useRouter,
  useRoute,
  useRuntimeConfig,
  useState,
  useNuxtApp,
  useToast,           // When using installModule('@nuxt/ui')
  useCookie,
  createError,
  showError
} from '#imports'
```

### 2. Vue Composition API - Explicit Imports

```typescript
// ✅ CORRECT - Explicit Vue imports
import { ref, computed, reactive, watch, onMounted, nextTick } from 'vue'

// ❌ WRONG - These are not auto-imported in published modules
const count = ref(0)          // "ref is not defined"
const doubled = computed()    // "computed is not defined"
```

### 3. Server-Side API Routes

```typescript
// src/runtime/server/api/example.post.ts
// ✅ CORRECT - Server routes need explicit imports too
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const { supabaseUrl } = useRuntimeConfig()  // Now works!
  // ...
})
```

### 4. Third-Party Dependencies via `installModule`

```typescript
// src/module.ts
export default defineNuxtModule({
  async setup(options, nuxt) {
    // ✅ Ensure dependencies are available
    await installModule('@nuxt/ui')
    await installModule('@nuxtjs/supabase', {
      url: options.supabaseUrl,
      key: options.supabaseKey
    })
  }
})
```

Then in runtime code:
```typescript
// ✅ Now useToast is available from #imports
import { useToast } from '#imports'

const toast = useToast()
```

## Module Setup Best Practices

### 1. Use `installModule()` for Dependencies

```typescript
// src/module.ts
import { defineNuxtModule, installModule, addComponentsDir, addImportsDir } from '@nuxt/kit'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-supabase-team-auth',
    configKey: 'teamAuth',
    compatibility: { nuxt: '^3.0.0' }
  },
  
  async setup(options, nuxt) {
    // ✅ Install required modules
    await installModule('@nuxtjs/supabase', {
      url: options.supabaseUrl,
      key: options.supabaseKey,
      redirectOptions: options.redirectOptions
    })
    
    // ✅ Install UI framework
    await installModule('@nuxt/ui')
    
    // ✅ Add runtime directory
    const { resolve } = createResolver(import.meta.url)
    addComponentsDir({ path: resolve('./runtime/components') })
    addImportsDir(resolve('./runtime/composables'))
    
    // ✅ Add server middleware
    addServerHandler({
      route: '/api/signup-with-team',
      handler: resolve('./runtime/server/api/signup-with-team.post.ts')
    })
  }
})
```

### 2. Package.json Dependency Strategy

```json
{
  "dependencies": {
    "@nuxt/kit": "^3.13.0",
    "@nuxtjs/supabase": "^1.5.0",
    "commander": "^14.0.0",
    "defu": "^6.1.4"
  },
  "peerDependencies": {
    "@nuxt/icon": "^1.0.0",
    "@nuxt/ui": "^3.0.0"
  },
  "devDependencies": {
    "@nuxt/module-builder": "^0.8.4",
    "nuxt": "^3.13.0"
  }
}
```

**Strategy**:
- **`dependencies`**: Core utilities and modules you `installModule()`
- **`peerDependencies`**: Frameworks consumer needs (flexible versions)
- **`devDependencies`**: Build tools and testing dependencies

### 3. PeerDependencies Best Practices

#### ✅ When to Use PeerDependencies

```json
{
  "peerDependencies": {
    "@nuxt/icon": "^1.0.0",      // UI framework icons
    "@nuxt/ui": "^3.0.0"         // UI framework components
  }
}
```

**Use peerDependencies for**:
- UI frameworks (Nuxt UI, Vuetify, etc.)
- Icon libraries (@nuxt/icon, @iconify, etc.)
- Large dependencies consumer likely already has
- Framework versions that need to match consumer's setup

#### ✅ Flexible Version Ranges

```json
{
  "peerDependencies": {
    // ✅ GOOD - Flexible, supports 3.0.x, 3.1.x, 3.2.x
    "@nuxt/ui": "^3.0.0",
    
    // ❌ BAD - Too restrictive, breaks with 3.0.x
    "@nuxt/ui": "^3.1.0",
    
    // ✅ GOOD - Any 1.x version
    "@nuxt/icon": "^1.0.0"
  }
}
```

**Key Insights**:
- `^3.0.0` means `>=3.0.0 <4.0.0` (supports 3.0.x, 3.1.x, 3.2.x)
- `^3.1.0` means `>=3.1.0 <4.0.0` (excludes 3.0.x - too restrictive!)
- Always use the **lowest compatible version** as the minimum

#### ❌ Common PeerDependency Mistakes

```json
{
  // ❌ Don't add to devDependencies if it's a peerDependency
  "peerDependencies": {
    "@nuxt/ui": "^3.0.0"
  },
  "devDependencies": {
    "@nuxt/ui": "^3.2.0"  // ❌ WRONG - Conflicting versions!
  }
}
```

**Problems this causes**:
- Version conflicts in consumer projects
- Consumer gets different version than expected
- Type mismatches between dev and runtime

#### ✅ Correct Approach

```json
{
  "peerDependencies": {
    "@nuxt/ui": "^3.0.0"
  },
  "devDependencies": {
    // ✅ Don't include peerDependencies here
    // ✅ Install separately in playground/test projects
  }
}
```

**How to handle development**:
```bash
# Install peerDependencies in playground for testing
cd playground
pnpm add @nuxt/ui@^3.2.0

# Or in test projects
cd test-projects/minimal-app  
pnpm add @nuxt/ui@^3.0.0
```

#### 🎯 PeerDependency Decision Matrix

| Dependency Type | Use Case | Example | Strategy |
|-----------------|----------|---------|----------|
| **dependencies** | Core module utilities | `@nuxt/kit`, `@nuxtjs/supabase` | `installModule()` these |
| **peerDependencies** | UI frameworks, large libs | `@nuxt/ui`, `@nuxt/icon` | Consumer installs |
| **devDependencies** | Build tools, testing | `@nuxt/module-builder`, `vitest` | Development only |

#### 🚨 Testing PeerDependencies

```bash
# 1. Test with minimum supported version
pnpm add @nuxt/ui@3.0.0
pnpm run dev

# 2. Test with latest version  
pnpm add @nuxt/ui@latest
pnpm run dev

# 3. Test consumer project with their versions
cd consumer-project
pnpm add my-module
# Should work with their existing @nuxt/ui version
```

### 4. Runtime Configuration

```typescript
// ✅ Expose options to runtime via runtimeConfig
nuxt.options.runtimeConfig.public.teamAuth = {
  loginPage: options.loginPage,
  redirectTo: options.redirectTo,
  debug: options.debug
}

// ❌ Don't modify process.env in modules
process.env.TEAM_AUTH_DEBUG = 'true' // WRONG - won't work in production
```

## Client-Side Patterns

### Vue Components

```vue
<template>
  <UButton @click="handleSignOut">Sign Out</UButton>
</template>

<script setup lang="ts">
// ✅ Explicit imports for everything
import { ref, computed, onMounted } from 'vue'
import { useRouter, navigateTo, useToast } from '#imports'
import { useTeamAuth } from '../composables/useTeamAuth'

const router = useRouter()
const toast = useToast()
const { signOut, currentUser } = useTeamAuth()

const handleSignOut = async () => {
  try {
    await signOut()
    toast.add({ title: 'Signed out successfully' })
    await navigateTo('/signin')
  } catch (error) {
    toast.add({ title: 'Error signing out', color: 'red' })
  }
}
</script>
```

### Composables

```typescript
// src/runtime/composables/useTeamAuth.ts
import { ref, computed, watch } from 'vue'
import { useToast, useState, useRuntimeConfig } from '#imports'
import { useSupabaseClient } from './useSupabaseComposables'

export const useTeamAuth = () => {
  const toast = useToast()
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient()
  
  // Reactive state
  const currentUser = useState('team-auth.user', () => null)
  const currentTeam = useState('team-auth.team', () => null)
  
  // Methods
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    // Clear state
    currentUser.value = null
    currentTeam.value = null
  }
  
  return {
    currentUser: readonly(currentUser),
    currentTeam: readonly(currentTeam),
    signOut
  }
}
```

### Middleware

```typescript
// src/runtime/middleware/require-auth.ts
import { navigateTo, defineNuxtRouteMiddleware, useRuntimeConfig } from '#imports'
import { useTeamAuth } from '../composables/useTeamAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useTeamAuth()
  const { loginPage } = useRuntimeConfig().public.teamAuth
  
  if (!currentUser.value) {
    return navigateTo(loginPage)
  }
})
```

## Server-Side Patterns

### API Routes

```typescript
// src/runtime/server/api/invite-member.post.ts
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  // ✅ Get config in server context
  const config = useRuntimeConfig()
  const { supabaseUrl, supabaseKey } = config
  
  // ✅ Read request body
  const { email, role, teamId } = await readBody(event)
  
  // ✅ Get auth header
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization header'
    })
  }
  
  // Call edge function
  const response = await $fetch(`${supabaseUrl}/functions/v1/invite-member`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: { email, role, team_id: teamId }
  })
  
  return response
})
```

### Server Utilities

```typescript
// src/runtime/server/utils/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

export const getSupabaseServiceClient = () => {
  const config = useRuntimeConfig()
  return createClient(
    config.supabaseUrl,
    config.supabaseServiceKey
  )
}
```

## Testing Configuration

### Vitest Config for Modules

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#app': fileURLToPath(new URL('./tests/mocks/nuxt-app.ts', import.meta.url)),
      '#imports': 'nuxt',  // ✅ Key: Point to nuxt for proper resolution
      'ofetch': fileURLToPath(new URL('./tests/mocks/ofetch.ts', import.meta.url))
    }
  }
})
```

### Test Mocks

```typescript
// tests/mocks/nuxt-app.ts
import { vi } from 'vitest'

export const useToast = vi.fn(() => ({
  add: vi.fn()
}))

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn()
}))

export const navigateTo = vi.fn()
export const defineNuxtRouteMiddleware = vi.fn((fn: any) => fn)
export const useRuntimeConfig = vi.fn(() => ({
  public: {
    teamAuth: {
      loginPage: '/signin'
    }
  }
}))
```

## Build & Distribution

### Using @nuxt/module-builder

```json
{
  "scripts": {
    "build": "nuxt-module-build build",
    "prepack": "nuxt-module-build build",
    "prepare": "nuxt-module-build build"
  }
}
```

**Benefits**:
- ✅ Zero-config TypeScript compilation
- ✅ Proper runtime directory handling  
- ✅ Correct `.d.ts` generation
- ✅ Asset bundling for distribution

### Release Process (CRITICAL)

```bash
# 1. ✅ ALWAYS test locally first
cd test-projects/minimal-nuxt-ui-app
pnpm update my-module
pnpm run dev  # Test thoroughly!

# 2. ✅ Only publish if local tests pass
pnpm run lint
pnpm run build
npm version patch
npm publish
```

**❌ NEVER publish without local testing** - this is how we shipped broken versions!

## Common Errors & Solutions

### ❌ "useToast is not defined"

**Problem**: Missing import in Vue component
```vue
<script setup>
// ❌ Missing import
const toast = useToast()
</script>
```

**Solution**: Add explicit import
```vue
<script setup>
// ✅ Explicit import
import { useToast } from '#imports'
const toast = useToast()
</script>
```

### ❌ "useRuntimeConfig is not defined" (Server)

**Problem**: Missing import in server API route
```typescript
// ❌ Missing import
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig() // Error!
})
```

**Solution**: Add explicit import
```typescript
// ✅ Explicit import
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig() // Works!
})
```

### ❌ "defineNuxtRouteMiddleware is not defined"

**Problem**: Missing import in middleware
```typescript
// ❌ Missing import  
export default defineNuxtRouteMiddleware(() => {
  // Error!
})
```

**Solution**: Add explicit import
```typescript
// ✅ Explicit import
import { defineNuxtRouteMiddleware, navigateTo } from '#imports'

export default defineNuxtRouteMiddleware(() => {
  // Works!
})
```

### ❌ "computed is not defined"

**Problem**: Missing Vue import
```vue
<script setup>
// ❌ Missing import
const doubledValue = computed(() => value.value * 2)
</script>
```

**Solution**: Add Vue import
```vue
<script setup>
// ✅ Explicit Vue import
import { computed } from 'vue'
const doubledValue = computed(() => value.value * 2)
</script>
```

## Module Architecture Checklist

### ✅ Dependencies
- [ ] Use `installModule()` for all module dependencies
- [ ] Put installable modules in `dependencies`
- [ ] Put consumer requirements in `peerDependencies`  
- [ ] Use flexible version ranges (e.g., `^3.0.0`)
- [ ] Don't duplicate peerDependencies in devDependencies
- [ ] Test with minimum and maximum supported peerDependency versions
- [ ] Use lowest compatible version as peerDependency minimum

### ✅ Runtime Code
- [ ] Import ALL Nuxt utilities from `#imports`
- [ ] Import ALL Vue composables from `'vue'`
- [ ] Import third-party composables from `#imports` (after `installModule`)
- [ ] Use explicit imports in both client AND server code

### ✅ Build & Testing
- [ ] Use `@nuxt/module-builder` for packaging
- [ ] Configure vitest with `#imports: 'nuxt'` alias
- [ ] **CRITICAL: Test locally before every release**
- [ ] Verify in consumer app using published version
- [ ] Run lint and build before publishing
- [ ] Test with both minimum and latest peerDependency versions

### ✅ Server APIs
- [ ] Import `useRuntimeConfig` from `#imports` in all API routes
- [ ] Import other Nuxt utilities explicitly
- [ ] Use proper error handling with `createError`

## Official Resources

- [Nuxt Module Guide](https://nuxt.com/docs/guide/going-further/modules)
- [Nuxt Kit API](https://nuxt.com/docs/api/kit/modules)
- [@nuxt/module-builder](https://github.com/nuxt/module-builder)
- [Auto-imports Documentation](https://nuxt.com/docs/guide/concepts/auto-imports)

## Key Takeaway

**Published Nuxt modules are fundamentally different from local development**. The #1 rule is: **explicit imports for everything**. When in doubt, import it explicitly from `#imports` or the source module.
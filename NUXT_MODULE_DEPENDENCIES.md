# Nuxt Module Dependencies - Comprehensive Implementation Guide

**Based on Official Nuxt Documentation**: https://nuxt.com/docs/guide/going-further/modules

## Core Principles: Runtime vs Build-time Separation

### ✅ Build-time Only (Modules)
Nuxt modules are **build-time only dependencies** that run during Nuxt startup:
- Modules configure the application during build
- Use `installModule()` for dependencies  
- Use `runtimeConfig` to expose options to runtime
- Complete setup quickly (< 1 second for async operations)

### ❌ Avoid Runtime Dependencies
- Don't hook into Nuxt runtime from modules
- Don't update `process.env` within modules
- Avoid runtime hooks like `vue-renderer:*`
- Don't import serverMiddleware directly in modules

## Auto-imports: The Core Issue

### Critical Finding: Published Module Limitations
**Official Quote**: *"Published modules cannot leverage auto-imports from node_modules"*

**Why This Breaks Consumer Apps**:
```typescript
// ❌ This fails in published modules (node_modules)
import { useSupabaseClient } from '#imports'
import { serverSupabaseClient } from '#supabase/server'

// ✅ This works - explicit imports from actual modules
import { useSupabaseClient } from '@supabase/supabase-js'
```

### Auto-import Behavior Differences
- **Local Development**: `#imports` resolves correctly
- **Published Module**: `#imports` fails, needs explicit module paths
- **Reason**: Performance optimization in node_modules

## Correct Dependency Management

### 1. Use `installModule()` Pattern
```typescript
// src/module.ts
import { defineNuxtModule, installModule, createResolver } from '@nuxt/kit'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-supabase-team-auth',
    configKey: 'teamAuth',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    // Static defaults
    redirectTo: '/dashboard',
    loginPage: '/signin'
  },
  async setup(options, nuxt) {
    // Install dependencies using Nuxt Kit
    await installModule('@nuxtjs/supabase', {
      // Pass configuration options
      url: options.supabaseUrl,
      key: options.supabaseKey
    })
    
    // Additional module setup...
  }
})
```

### 2. Package.json Structure
```json
{
  "dependencies": {
    "@nuxt/kit": "^3.0.0",
    "@nuxtjs/supabase": "^1.5.0"
  },
  "peerDependencies": {
    "@nuxt/ui": "^3.0.0",
    "nuxt": "^3.0.0"
  }
}
```

**Dependencies Strategy**:
- **`dependencies`**: Modules that are `installModule()`-ed  
- **`peerDependencies`**: Required by consumer, not auto-installed
- **`devDependencies`**: Build tools only

### 3. Runtime Configuration
```typescript
// ✅ Expose module options to runtime
nuxt.options.runtimeConfig.public.teamAuth = {
  supabaseUrl: options.supabaseUrl,
  redirectTo: options.redirectTo
}

// ❌ Don't modify process.env in modules
process.env.CUSTOM_VAR = 'value' // WRONG
```

## Runtime Code Patterns

### Server-side Utilities
```typescript
// src/runtime/server/utils/supabase.ts
// ✅ Explicit imports work in published modules
export {
  serverSupabaseServiceRole,
  serverSupabaseClient,
  serverSupabaseUser
} from '@nuxtjs/supabase/dist/runtime/server/utils'

// ❌ Auto-imports fail in published modules  
// export { serverSupabaseClient } from '#supabase/server'
```

### Client-side Composables
```typescript
// src/runtime/composables/useTeamAuth.ts
// ✅ Import from the actual module when possible
// Or rely on consumer app's auto-imports for common utilities
```

### Component Dependencies
```typescript
// ✅ Modules can depend on each other
import { useToast } from '@nuxt/ui'  // Direct dependency is fine

// ❌ Don't implement fallbacks for peer dependencies
// Let consumer install required dependencies
```

## Module Builder & Distribution

### Building with @nuxt/module-builder
```json
{
  "scripts": {
    "build": "nuxt-module-build build",
    "prepack": "nuxt-module-build build"
  }
}
```

**Features**:
- Zero configuration TypeScript support
- Proper asset bundling for distribution
- Handles runtime directory compilation
- Generates correct `.d.ts` files

### Testing Strategy
```bash
# 1. Local testing with file paths
modules: ['./src/module.ts']

# 2. Packed testing
npm pack
npm install nuxt-supabase-team-auth-0.1.0.tgz

# 3. Consumer app testing
npm install nuxt-supabase-team-auth
```

## Implementation Checklist

### Module Setup
- [ ] Use `installModule()` for module dependencies
- [ ] Put installable modules in `dependencies`
- [ ] Put consumer requirements in `peerDependencies`
- [ ] Use `runtimeConfig` for runtime options
- [ ] Complete async setup in < 1 second

### Runtime Code
- [ ] Use explicit imports instead of `#imports`
- [ ] Import from actual module paths, not virtual paths
- [ ] Reference serverMiddleware by file path, not direct import
- [ ] Avoid runtime hooks in production

### Build & Distribution
- [ ] Use `@nuxt/module-builder` for packaging
- [ ] Test with `npm pack` before publishing
- [ ] Verify in consumer app using published version
- [ ] Document peer dependency requirements

## Common Pitfalls & Solutions

### ❌ Problem: "#imports not found"
```typescript
// Broken
import { useSupabaseClient } from '#imports'
```
**Solution**: Use explicit imports or rely on consumer's environment

### ❌ Problem: "Cannot resolve #supabase/server"  
```typescript
// Broken
import { serverSupabaseClient } from '#supabase/server'
```
**Solution**: Import from actual module path:
```typescript
import { serverSupabaseClient } from '@nuxtjs/supabase/dist/runtime/server/utils'
```

### ❌ Problem: Manual module registration
```typescript
// Broken
nuxt.options.modules.unshift('@nuxtjs/supabase')
```
**Solution**: Use `installModule()`:
```typescript
await installModule('@nuxtjs/supabase')
```

## Official Resources

- [Nuxt Module Guide](https://nuxt.com/docs/guide/going-further/modules)
- [Nuxt Kit API](https://nuxt.com/docs/api/kit/modules)  
- [@nuxt/module-builder](https://github.com/nuxt/module-builder)
- [Module Examples](https://github.com/nuxt/examples/tree/main/advanced/module)
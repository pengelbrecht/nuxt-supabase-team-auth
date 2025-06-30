# Nuxt Module Dependencies - Research & Implementation Guide

## Key Finding: Auto-imports Don't Work in Published Modules

**Critical Insight**: Published modules cannot leverage auto-imports for assets within their runtime directory. This is why consumer apps get "[unimport] failed to find 'useSupabaseClient' imported from '#imports'".

**Source**: Official Nuxt documentation confirms: "Auto-imports are not enabled for files within node_modules for performance reasons."

## Recommended Solution: Use `installModule()`

Based on research of successful modules like `@nuxt/ui`, the correct pattern is:

1. **Module Dependencies**: Put dependencies in `dependencies`, NOT `peerDependencies`
2. **Use installModule()**: Use Nuxt Kit's `installModule()` to register dependencies
3. **Explicit Imports**: Use explicit imports from '#imports' in runtime code

### Example Implementation

```typescript
// src/module.ts
import { defineNuxtModule, installModule } from '@nuxt/kit'

export default defineNuxtModule({
  async setup(options, nuxt) {
    // Install dependent module
    await installModule('@nuxtjs/supabase')
    
    // ... rest of setup
  }
})
```

```typescript
// package.json dependencies (not peerDependencies)
{
  "dependencies": {
    "@nuxtjs/supabase": "^1.5.0"
  }
}
```

## What We Tried vs What Works

### L Our Failed Attempts
- Putting `@nuxtjs/supabase` in `peerDependencies`
- Manual module registration with `nuxt.options.modules.unshift()`
- Relying on auto-imports from '#imports' in transpiled code

###  Proven Pattern (@nuxt/ui)
- Dependencies in `dependencies` section
- Uses `installModule()` from `@nuxt/kit`
- Explicit imports where needed

## Implementation Steps

1. Move `@nuxtjs/supabase` from `peerDependencies` to `dependencies`
2. Replace manual module registration with `installModule('@nuxtjs/supabase')`
3. Update runtime code to use explicit imports from '#imports'
4. Test in playground before releasing

## Key Lessons

- **Performance**: Auto-imports disabled in node_modules for performance
- **Transpilation**: Module builder transpiles code, breaking auto-import assumptions
- **Best Practice**: Follow established patterns from successful modules
- **Testing**: Always test module dependencies in playground first
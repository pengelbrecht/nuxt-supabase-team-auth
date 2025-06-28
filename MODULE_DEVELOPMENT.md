# Module Development Guide

This guide is for **developers working on the nuxt-supabase-team-auth module itself**. If you're looking to use this module in your project, see [README.md](./README.md) instead.

## Table of Contents

- [Project Architecture](#project-architecture)
- [Development Setup](#development-setup)
- [Module Structure](#module-structure)
- [Database Development](#database-development)
- [Testing Strategy](#testing-strategy)
- [Component Development](#component-development)
- [CLI Development](#cli-development)
- [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)

## Project Architecture

### Project Type
This is a **Nuxt 3 module** designed to be installed in other Nuxt projects. Key characteristics:

- **Module code**: Lives in `/src/runtime/` 
- **Playground**: `/playground/` directory for testing and showcasing
- **Distribution**: Built module goes to `/dist/` for NPM publishing
- **Testing**: The playground consumes the module for E2E testing

### Package Manager
- **Always use `pnpm`** - NOT npm or yarn
- Commands: `pnpm install`, `pnpm run dev`, `pnpm run build`, etc.

### Key Directories
```
├── src/                      # Module source code
│   ├── cli.ts               # CLI implementation  
│   ├── module.ts            # Nuxt module definition
│   └── runtime/             # Runtime code (components, composables, etc.)
├── playground/              # Development playground
├── supabase/                # Database schema, migrations, edge functions
├── tests/                   # Comprehensive test suite
├── test-projects/           # External test projects for validation
└── docs/                    # Documentation
```

## Development Setup

### 1. Clone and Install
```bash
git clone https://github.com/pengelbrecht/nuxt-supabase-team-auth.git
cd nuxt-supabase-team-auth
pnpm install
```

### 2. Database Setup
```bash
# Start local Supabase (Docker required)
pnpm run db:start

# Check status
pnpm run db:status

# Reset database with fresh migrations
pnpm run db:reset
```

### 3. Development Server
```bash
# Start development playground
pnpm run dev

# Build module (for testing distribution)
pnpm run build
```

### 4. Run Tests
```bash
# Unit tests
pnpm run test

# E2E tests  
pnpm run test:e2e

# Type checking
pnpm run test:types

# All tests
pnpm run test:all
```

## Module Structure

### Server Routes Architecture
- **Server routes belong in `/src/runtime/server`** - All API routes are part of the module
- **Playground uses symlinks** - Files in `/playground/server` are symlinked to `/src/runtime/server`
- This avoids duplicating files and ensures module code stays in the correct location

#### Adding New Server Routes
```bash
# 1. Create route in module
# /src/runtime/server/api/new-route.post.ts

# 2. Symlink to playground for testing
cd playground/server/api
ln -sf ../../../src/runtime/server/api/new-route.post.ts new-route.post.ts
```

### Component Architecture
Components are organized by functionality:

- **Auth Components**: `AuthSignIn.vue`, `AuthSignUpWithTeam.vue`, `ForgotPasswordForm.vue`
- **User Components**: `UserButton.vue`, `ProfileForm.vue`, `UserCard.vue`
- **Team Components**: `TeamForm.vue`, `TeamMembersDialog.vue`, `CompanySettingsDialog.vue`
- **Dialog System**: `DialogBox.vue`, `FormDialog.vue`, `ConfirmDialog.vue`, `ActionDialog.vue`
- **Utility Components**: `RoleBadge.vue`, `ImpersonationBanner.vue`

### Composables
- **`useTeamAuth`**: Core authentication logic (100% test coverage, uses @nuxtjs/supabase)
- **`useSession`**: Session state management wrapper
- **`useSessionSync`**: Cross-tab session synchronization
- **`useTeamAuthConfig`**: Module configuration access
- **External**: `useSupabaseClient()`, `useSupabaseSession()` from @nuxtjs/supabase

### Middleware System
- **`auth.global.ts`**: Global authentication middleware
- **`require-auth.ts`**: Require authentication
- **`require-role.ts`**: Require specific role
- **`require-team.ts`**: Require team membership
- **`redirect-authenticated.ts`**: Redirect authenticated users
- **`impersonation.ts`**: Handle impersonation state

## Database Development

### Schema Architecture (Established - Don't Change)
- **`auth.users`**: Supabase auth users (managed by Supabase)
- **`public.profiles`**: User profile data (full_name, avatar_url, etc.)
- **`public.teams`**: Team information
- **`public.team_members`**: Team memberships and roles
- **`public.impersonation_sessions`**: Super admin impersonation tracking

### Core Principles
- **@nuxtjs/supabase integration** - Uses official Nuxt Supabase module for better ESM/CJS compatibility
- **No JWT claims** - Always fetch team data from database via team_members join
- **User profile data** stored in `public.profiles.id` which equals `auth.uid()`
- **RLS policies** secure all data access
- **Edge Functions** handle complex operations (invitations, team creation, etc.)

### Module Architecture Changes (v0.2.0+)
After v0.2.0, the module was refactored to use `@nuxtjs/supabase`:

- **Before**: Direct `@supabase/supabase-js` imports with custom client management
- **After**: `@nuxtjs/supabase` composables (`useSupabaseClient()`, `useSupabaseSession()`, etc.)
- **Benefits**: Better ESM/CJS compatibility, industry standard patterns, smaller bundle size
- **Testing**: Integration tests use `@supabase/supabase-js` as dev dependency only

### Migration Management
```bash
# Check for schema changes
pnpm run types:check

# Generate new types after schema changes  
pnpm run types:generate

# Apply migrations to reset database
pnpm run db:reset
```

### RLS Policy Testing
Comprehensive RLS policy tests in `tests/rls-policies.test.ts` cover:
- Profile access control
- Team membership policies  
- Role-based permissions
- Impersonation security

### Edge Functions
Located in `supabase/functions/`:
- **create-team-and-owner**: Team creation with owner assignment
- **invite-member**: Send team invitations
- **accept-invite**: Accept team invitations
- **transfer-ownership**: Transfer team ownership
- **start-impersonation**: Super admin impersonation
- **stop-impersonation**: End impersonation session
- **delete-team**: Comprehensive team deletion

## Testing Strategy

### Test Structure
```
tests/
├── components/           # Component unit tests
├── composables/          # Composable unit tests  
├── functions/           # Edge function integration tests
├── middleware/          # Middleware integration tests
├── features/           # Feature integration tests
├── helpers/            # Test utilities and factories
└── rls-policies.test.ts # Database security tests
```

### Test Database Management
- **Use CLI cleanup commands** instead of manual SQL
- **`team-auth cleanup --test-data`** safely removes test users
- **Test isolation** - Each test creates and cleans up its own data
- **Factory functions** in `tests/helpers/` create test data consistently

### Key Testing Principles
1. **100% test coverage** for core composables (`useTeamAuth`)
2. **Integration tests** for auth flows and RLS policies
3. **Component tests** with proper mocking
4. **Edge function tests** with test environment
5. **Middleware tests** with Nuxt integration

### Test Commands
```bash
# Watch mode for development
pnpm run test:watch

# Coverage report
pnpm run test --coverage

# Specific test file
pnpm run test tests/composables/useTeamAuth.test.ts

# E2E tests with UI
pnpm run test:e2e:ui
```

## Component Development

### Dialog Component System
We use a custom DialogBox component system instead of raw UModal:

- **DialogBox**: Base component for custom dialogs
- **FormDialog**: For forms with save/cancel functionality  
- **ConfirmDialog**: For confirmation prompts
- **ActionDialog**: For multi-action dialogs

### Form Design Patterns
Follow established patterns from ProfileForm:

```vue
<!-- Standard Horizontal Fields -->
<UFormField 
  label="Field Name" 
  name="field_name" 
  required 
  class="flex items-center justify-between mb-4 gap-2"
>
  <UInput v-model="form.field_name" size="md" />
</UFormField>

<!-- Avatar + File Upload Layout -->
<div class="flex items-center mb-4">
  <UAvatar size="xl">{{ initials }}</UAvatar>
  <div style="width: 1rem; flex-shrink: 0;"></div>
  <UFormField 
    label="Profile Picture" 
    name="avatar" 
    description="JPG, GIF or PNG. Max size 2MB." 
    class="flex items-center justify-between gap-2 flex-1"
  >
    <UInput type="file" accept="image/*" />
  </UFormField>
</div>
```

### Key Component Lessons
1. **Component loading states** - Use local loading state (`isProfileLoading`) NOT global auth loading state (`isLoading`)
2. **Watchers and background processes** - Watch specific properties (like user ID) not entire objects to avoid unnecessary triggers
3. **Form submission** - Use direct @click handlers instead of UForm @submit for complex forms
4. **Profile reloading** - Don't reload profile data after save, just update local form state

## CLI Development

### CLI Structure
The CLI is built with Commander.js in `src/cli.ts`:

```bash
team-auth init [--force]              # Initialize in Supabase project
team-auth migrate [--dry-run]         # Apply migrations
team-auth cleanup <options>           # Database cleanup
team-auth db <command>                # Database inspection
```

### Adding New CLI Commands
1. Add command definition in `src/cli.ts`
2. Implement logic (usually database operations)  
3. Add tests in appropriate test file
4. Update CLI documentation

### CLI Testing
```bash
# Build CLI for testing
pnpm run build

# Test CLI commands
./dist/cli.mjs --help
./dist/cli.mjs init --help
```

## Release Process

### Automated Release Workflow
Releases are handled by GitHub Actions:

1. **Version Bump**:
   ```bash
   pnpm run version:patch  # Bug fixes (0.1.0 → 0.1.1)
   pnpm run version:minor  # New features (0.1.0 → 0.2.0) 
   pnpm run version:major  # Breaking changes (0.1.0 → 1.0.0)
   ```

2. **Push Tags** (triggers release):
   ```bash
   git push --follow-tags
   ```

3. **Automated Pipeline**:
   - Lint, test, and build
   - Generate changelog
   - Create GitHub release
   - Publish to NPM

### Pre-Release Checklist
```bash
# Quality checks
pnpm run lint
pnpm run test
pnpm run test:types
pnpm run build

# Package validation
pnpm run validate:package

# Version info
pnpm run version:info
```

### Changelog Generation
Uses `changelogen` with conventional commits:

```bash
# Preview changelog
pnpm run changelog

# Generate changelog for release
pnpm run changelog:release
```

### Manual Release Process
When GitHub Actions are failing (e.g., lockfile issues), use manual release:

1. **Pre-Release Validation**:
   ```bash
   # Run quality checks
   pnpm run lint
   pnpm run test:types
   pnpm run build
   
   # Validate package
   pnpm run validate:package
   ```

2. **Commit All Changes**:
   ```bash
   git add -A
   git commit -m "fix: describe changes
   
   🤖 Generated with [Claude Code](https://claude.ai/code)
   
   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. **Version Bump and Publish**:
   ```bash
   # Bump version (creates git tag)
   npm version patch  # or minor/major
   
   # Publish to npm
   npm publish
   
   # Push changes and tags
   git push --follow-tags
   ```

4. **Create GitHub Release**:
   ```bash
   # Create release with notes
   gh release create v0.1.x --title "Release v0.1.x" --notes "Release notes here" --latest
   ```

**Note**: Manual releases bypass the automated changelog generation and some quality gates. Ensure all checks pass manually and write detailed release notes.

**Future Work**: Fix GitHub Actions automated release pipeline (currently failing on lockfile configuration mismatch).

## Troubleshooting

### Common Development Issues

#### Database Connection Issues
```bash
# Check Supabase status
supabase status

# Reset if corrupted
supabase stop
supabase start
pnpm run db:reset
```

#### Module Not Updating in Playground
```bash
# Clear Nuxt cache
rm -rf playground/.nuxt

# Rebuild module
pnpm run build

# Restart dev server
pnpm run dev
```

#### Test Database Pollution
```bash
# Clean test data
pnpm run db:clean

# Full reset
pnpm run db:reset
```

#### Type Errors After Schema Changes
```bash
# Regenerate types
pnpm run types:generate

# Fix any type issues
pnpm run test:types
```

### Development Commands Reference

#### Database Management
```bash
pnpm run db:start          # Start Supabase locally
pnpm run db:reset          # Reset database + apply migrations  
pnpm run db:status         # Check Supabase status
pnpm run db:clean          # Clean test data only
pnpm run cleanup           # Alias for db:clean
pnpm run cleanup:all       # Alias for db:reset
```

#### Testing Commands  
```bash
pnpm run test             # Unit tests
pnpm run test:watch       # Unit tests in watch mode
pnpm run test:e2e         # E2E tests
pnpm run test:e2e:ui      # E2E tests with UI
pnpm run test:types       # Type checking
pnpm run test:all         # All tests
```

#### Code Quality
```bash
pnpm run lint             # ESLint
pnpm run lint:fix         # Fix ESLint issues
pnpm run lint:md          # Markdown linting
pnpm run lint:md:fix      # Fix Markdown issues
```

#### Build and Distribution
```bash
pnpm run build            # Build module
pnpm run prepack          # Prepare for packaging
pnpm run pack:dry         # Dry run package creation
pnpm run validate:package # Validate package before release
```

### Environment Setup

#### Required Environment Variables
For full functionality, set up these in your development environment:

```bash
# Supabase (automatically configured by CLI)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<auto-generated>

# For cloud testing (optional)
SUPABASE_PROJECT_ID=<your-project-id>
```

#### IDE Setup
- **VS Code**: Install Vue, TypeScript, and ESLint extensions
- **TypeScript**: Ensure `vue-tsc` is working for type checking
- **ESLint**: Configure for automatic fixing on save

### Performance Considerations

- **Session sync**: Only syncs when necessary (user ID changes)
- **RLS queries**: Optimized with proper indexes
- **Component loading**: Use local loading states to prevent blocking
- **Auth watchers**: Watch specific properties, not entire objects

This guide should help you contribute effectively to the module. For consumer documentation, see [README.md](./README.md). For contributing guidelines, see [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).
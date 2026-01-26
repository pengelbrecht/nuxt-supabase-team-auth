# Nuxt UI v3 to v4 Migration Research

## Current State

**Installed Version:** @nuxt/ui 3.3.3 (peer dependency set to `^3.0.0`)

## Components Used in Project

| Category | Components |
|----------|------------|
| Forms | UForm, UFormField, UInput, USelect, UCheckbox |
| Layout | UCard, UModal, UTabs |
| Navigation | UButton, UDropdownMenu |
| Display | UAlert, UAvatar, UBadge, UIcon |

## Key Areas to Monitor for Breaking Changes

### 1. v-model Modifier Changes (nullify -> nullable)

Current v3 Input component supports these modelModifiers:
```typescript
modelModifiers?: {
  string?: boolean;
  number?: boolean;
  trim?: boolean;
  lazy?: boolean;
  nullify?: boolean;  // This may become 'nullable' in v4
}
```

**Status:** No usage of `v-model.nullify` found in current codebase - no changes needed.

### 2. UModal Usage

The project uses `v-model:open` syntax in multiple places:
- `/src/runtime/components/DialogBox.vue` - line 3
- `/src/runtime/components/TeamForm.vue` - line 368
- `/src/runtime/components/TeamMembersDialog.vue` - line 245

The DialogBox wrapper pattern is advantageous - UModal changes only need to be fixed in one place.

### 3. Files Requiring Migration Review

High-priority files based on Nuxt UI component density:

1. **DialogBox.vue** - Core modal wrapper
2. **TeamForm.vue** - Heavy use of UForm, UCard, UTabs, UDropdownMenu, USelect
3. **AuthSignUpWithTeam.vue** - Complex form with UForm, UFormField, UInput, UCheckbox
4. **AuthSignIn.vue** - Sign-in form
5. **TeamMembersDialog.vue** - Team member management
6. **UserButton.vue** - UDropdownMenu for user menu
7. **ProfileForm.vue** - User profile editing

## Migration Checklist

- [ ] Verify v4 release exists and get official migration guide
- [ ] Check UModal API changes (v-model:open syntax)
- [ ] Check UDropdownMenu API changes
- [ ] Check UForm/UFormField behavior changes
- [ ] Check USelect changes
- [ ] Update DialogBox.vue (single point for modal changes)
- [ ] Test all forms after migration
- [ ] Verify slot API compatibility

## Recommendations

1. **DialogBox Wrapper Pattern:** The codebase already uses a DialogBox wrapper component - this makes UModal migration easier since changes are centralized.

2. **Form Patterns:** CLAUDE.md documents proven form patterns that should be preserved.

3. **Progressive Migration:** Update DialogBox first, then test all dialogs before touching individual components.

## TODO

- [ ] Access https://ui.nuxt.com for official v4 documentation
- [ ] Check https://github.com/nuxt/ui/releases for v4 changelog
- [ ] Verify exact prop/slot changes once v4 docs available

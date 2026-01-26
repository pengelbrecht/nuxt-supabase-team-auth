# Nuxt UI Component Audit Report

## Summary Table

| Component | Usage Count | Files Using It |
|-----------|-------------|----------------|
| **UButton** | 56 | 18 files |
| **UInput** | 40 | 13 files |
| **UFormField** | 38 | 12 files |
| **UCard** | 21 | 13 files |
| **UForm** | 11 | 9 files |
| **UAvatar** | 10 | 7 files |
| **UAlert** | 6 | 5 files |
| **USelect** | 6 | 3 files |
| **UIcon** | 6 | 4 files |
| **UDropdownMenu** | 4 | 3 files |
| **UModal** | 1 | 1 file |
| **UCheckbox** | 3 | 2 files |
| **UTabs** | 1 | 1 file |
| **UBadge** | 1 | 1 file |

---

## Detailed Component Analysis

### UButton (56 usages in 18 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `type` | `"button"`, `"submit"` | Form submission control |
| `variant` | `"ghost"`, `"outline"`, `"solid"` | Visual style |
| `size` | `"xs"`, `"sm"`, `"md"`, `"lg"` | Size variations |
| `color` | `"primary"`, `"gray"`, `"red"`, `"green"`, `"neutral"` | Color theming |
| `block` | `true` | Full-width buttons |
| `loading` | dynamic | Loading state indicator |
| `disabled` | dynamic | Disable interaction |
| `icon` | Various icon names | Icon-only or leading icon |

**Slots Used:**
- `#leading` - For custom icons (social login buttons)
- `#trailing` - For password visibility toggle buttons inside UInput

---

### UInput (40 usages in 13 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `v-model` | various | Two-way binding |
| `type` | `"text"`, `"email"`, `"password"`, `"file"` | Input type |
| `placeholder` | various strings | Placeholder text |
| `disabled` | dynamic | Disable input |
| `icon` | `"i-heroicons-*"`, `"i-lucide-*"` | Leading icon |
| `size` | `"md"`, `"lg"` | Size variations |
| `autocomplete` | `"email"`, `"new-password"`, `"current-password"` | Autofill hints |
| `:ui` | `{ trailing: { padding: { sm: 'pe-2' } } }` | UI customization for password toggle |

**Slots Used:**
- `#trailing` - Password visibility toggle buttons

---

### UFormField (38 usages in 12 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `label` | various strings | Field label |
| `name` | various strings | Form field name for validation |
| `required` | `true` | Required indicator |
| `help` | dynamic strings | Help text below input |
| `description` | strings | Description text |
| `error` | dynamic | Error message |
| `class` | `"flex items-center justify-between mb-4 gap-2"`, `"mb-4"` | Layout classes |

---

### UCard (21 usages in 13 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `class` | `"w-full"`, `"w-full max-w-md"`, `"mb-6"` | Width/spacing control |
| `variant` | `"subtle"` | Nested card styling |
| `:ui` | `{ body: 'p-0 sm:p-0' }` | Custom body padding |

**Slots Used:**
- `#header` - Card header with titles and actions
- `#footer` - Card footer with links

---

### UForm (11 usages in 9 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `:schema` | Valibot schema objects | Validation schema |
| `:state` | reactive form objects | Form state |
| `class` | `"space-y-6"`, `"space-y-4"`, `"space-y-8"` | Form spacing |

**Events Used:**
- `@submit` - Form submission handler (receives `FormSubmitEvent<any>`)

---

### UAvatar (10 usages in 7 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `size` | `"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"2xl"`, `"3xl"` | Size variations |
| `src` | dynamic URL | Avatar image source |
| `alt` | dynamic string | Alt text |
| `icon` | `"i-lucide-user"` | Fallback icon |
| `:ui` | `{ background: 'bg-orange-100 dark:bg-orange-900' }` | Custom background |

**Slots Used:**
- Default slot - For initials text fallback

---

### UAlert (6 usages in 5 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `color` | `"red"`, `"green"`, dynamic | Alert color |
| `variant` | `"subtle"` | Visual style |
| `title` | dynamic strings | Alert title |
| `description` | dynamic strings | Alert description |
| `icon` | `"i-heroicons-exclamation-triangle"`, `"i-heroicons-check-circle"` | Alert icon |
| `:close-button` | `{ icon: 'i-lucide-x', color: 'gray', variant: 'ghost', tabindex: '-1' }` | Close button config |

**Events Used:**
- `@close` - Alert dismissal handler

---

### USelect (6 usages in 3 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `v-model` | dynamic | Two-way binding |
| `:items` | array of `{ label, value }` objects | Select options |
| `disabled` | dynamic | Disable select |
| `size` | `"md"` | Size |
| `color` | `"neutral"` | Color theme |
| `:ui` | `{ value: 'capitalize', item: 'capitalize' }` | Text transformation |

**Events Used:**
- `@update:model-value` - Value change handler

---

### UDropdownMenu (4 usages in 3 files)

**Files:** UserButton.vue, TeamForm.vue, TeamMembersDialog.vue

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `:items` | array of menu items | Menu configuration |
| `:content` | `{ align: 'end' }` | Dropdown alignment |

**Item Structure:**
```typescript
{
  label: string
  icon?: string
  type?: 'label' | 'separator'
  disabled?: boolean
  onSelect?: () => void
}
```

---

### UModal (1 usage in 1 file)

**File:** DialogBox.vue (wrapper component)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `v-model:open` | boolean | Open state |
| `title` | string | Modal title |
| `description` | string | Modal subtitle |
| `:ui` | custom object | UI customization |

**Slots Used:**
- `#header` - Custom header with close button
- `#body` - Modal content

---

### UCheckbox (3 usages in 2 files)

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `v-model` | boolean | Checked state |
| `label` | string | Checkbox label |
| `required` | boolean | Required indicator |
| `disabled` | boolean | Disable checkbox |

**Slots Used:**
- `#label` - Custom label content with clickable links (terms acceptance)

---

### UTabs (1 usage in 1 file)

**File:** TeamForm.vue

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `v-model` | string | Active tab |
| `:items` | array of tab objects | Tab configuration |
| `variant` | `"link"` | Visual variant |

**Slots Used:**
- `#company` - Company settings tab content
- `#members` - Team members tab content

---

### UBadge (1 usage in 1 file)

**File:** RoleBadge.vue

**Props Used:**
| Prop | Values | Notes |
|------|--------|-------|
| `:color` | dynamic color names | Badge color |
| `:variant` | `"solid"`, `"outline"`, `"soft"`, `"subtle"` | Visual variant |
| `:size` | `"xs"`, `"sm"`, `"md"`, `"lg"` | Badge size |

---

## Flags / Potential Migration Issues

### 1. Mixed Icon Sets
The codebase uses both `i-heroicons-*` and `i-lucide-*` icons inconsistently. Consider standardizing on one icon set.

### 2. Hardcoded UI Customization
Password inputs use hardcoded `:ui="{ trailing: { padding: { sm: 'pe-2' } } }"` - could be centralized.

### 3. Inconsistent Class Patterns
Some UFormField uses `class="mb-4"`, others use `class="flex items-center justify-between mb-4 gap-2"`.

### 4. Duplicated Alert Close Button Config
The alert close button configuration is duplicated across files - could be extracted.

### 5. Aggressive CSS Overrides in DialogBox
DialogBox uses `!important` CSS rules to override modal width - may cause issues with UI updates.

### 6. Non-Standard Color Names
Some components use `"neutral"` color that may not be standard in all Nuxt UI versions.

---

## Components NOT Used

The following Nuxt UI components are NOT used in this module:
- UAccordion, UButtonGroup, UCarousel, UChip, UColorPicker
- UContextMenu, UDrawer, UNavigationMenu, UPagination, UPopover
- UProgress, URadio/URadioGroup, USkeleton, USlider, USlideover
- UStepper, USwitch, UTable, UTextarea, UToast, UTooltip

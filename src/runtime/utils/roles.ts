/**
 * Shared team role helpers.
 *
 * Apps can declare extra Postgres `team_role` enum values through the
 * `teamAuth.customRoles` module option. Everything here is pure (no Nuxt
 * imports) so it can be unit-tested and used from components and composables.
 */

export interface CustomRole {
  /** The Postgres `team_role` enum value, e.g. `'editor'` */
  value: string
  /** Human readable label shown in badges and dropdowns */
  label: string
}

export interface RoleOption {
  label: string
  value: string
}

export const BASE_ROLES = ['member', 'admin', 'owner', 'super_admin'] as const

/** Hierarchy level of the built-in roles. Unknown/custom roles count as member (1). */
export const ROLE_LEVELS: Record<string, number> = {
  super_admin: 4,
  owner: 3,
  admin: 2,
  member: 1,
}

const normalize = (customRoles?: CustomRole[] | null): CustomRole[] =>
  Array.isArray(customRoles)
    ? customRoles.filter(r => r && typeof r.value === 'string' && r.value.length > 0)
    : []

/** True if `role` is one of the declared custom roles. */
export function isCustomRole(role: string | null | undefined, customRoles?: CustomRole[] | null): boolean {
  if (!role) return false
  return normalize(customRoles).some(r => r.value === role)
}

/**
 * Display name for a role: the declared label for custom roles, 'Super Admin'
 * for super_admin, otherwise underscores become spaces and the first letter is
 * capitalised ("menu_editor" -> "Menu editor").
 */
export function formatRole(role: string | null | undefined, customRoles?: CustomRole[] | null): string {
  if (!role) return 'Unknown'
  const custom = normalize(customRoles).find(r => r.value === role)
  if (custom && custom.label) return custom.label
  if (role === 'super_admin') return 'Super Admin'
  const spaced = role.replace(/_/g, ' ').trim()
  if (!spaced) return 'Unknown'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Hierarchy level of a role; unknown and custom roles are level 1 (like member). */
export function getRoleLevel(role: string | null | undefined): number {
  if (!role) return 0
  return ROLE_LEVELS[role] ?? 1
}

const customOptions = (customRoles?: CustomRole[] | null): RoleOption[] =>
  normalize(customRoles).map(r => ({ label: r.label || formatRole(r.value), value: r.value }))

/**
 * Role options an actor may assign to an existing member.
 * Admin behaviour is unchanged (member/admin, only for current members);
 * custom roles are appended for owners and super admins only.
 */
export function getAvailableRoleOptions(
  currentRole: string | null | undefined,
  memberRole: string | null | undefined,
  customRoles?: CustomRole[] | null,
): RoleOption[] {
  const base: RoleOption[] = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ]

  if (currentRole === 'super_admin' || currentRole === 'owner') {
    return [...base, { label: 'Owner', value: 'owner' }, ...customOptions(customRoles)]
  }

  if (currentRole === 'admin' && memberRole === 'member') {
    return base
  }

  return []
}

/**
 * Role options an actor may choose when inviting. Super admins additionally
 * get owner (unchanged); custom roles are appended for owners and super admins.
 */
export function getInviteRoleOptions(
  currentRole: string | null | undefined,
  customRoles?: CustomRole[] | null,
): RoleOption[] {
  const base: RoleOption[] = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ]

  if (currentRole === 'super_admin') {
    return [...base, { label: 'Owner', value: 'owner' }, ...customOptions(customRoles)]
  }
  if (currentRole === 'owner') {
    return [...base, ...customOptions(customRoles)]
  }
  if (currentRole === 'admin') {
    return base
  }
  return []
}

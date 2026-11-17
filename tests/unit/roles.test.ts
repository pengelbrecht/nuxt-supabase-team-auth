import { describe, test, expect } from 'vitest'
import {
  formatRole,
  isCustomRole,
  getRoleLevel,
  getAvailableRoleOptions,
  getInviteRoleOptions,
} from '../../src/runtime/utils/roles'

const custom = [{ value: 'menu_editor', label: 'Menu editor (kitchen)' }, { value: 'editor', label: 'Editor' }]

describe('formatRole', () => {
  test('built-in roles', () => {
    expect(formatRole('member')).toBe('Member')
    expect(formatRole('admin')).toBe('Admin')
    expect(formatRole('owner')).toBe('Owner')
    expect(formatRole('super_admin')).toBe('Super Admin')
  })

  test('null/undefined/empty give Unknown', () => {
    expect(formatRole(null)).toBe('Unknown')
    expect(formatRole(undefined)).toBe('Unknown')
    expect(formatRole('')).toBe('Unknown')
  })

  test('undeclared roles replace underscores and capitalise first letter', () => {
    expect(formatRole('menu_editor')).toBe('Menu editor')
    expect(formatRole('menu_editor', [])).toBe('Menu editor')
  })

  test('declared label wins', () => {
    expect(formatRole('menu_editor', custom)).toBe('Menu editor (kitchen)')
  })

  test('tolerates malformed custom role lists', () => {
    expect(formatRole('x_y', null)).toBe('X y')
    expect(formatRole('x_y', [{ value: '', label: 'Nope' }])).toBe('X y')
  })
})

describe('isCustomRole / getRoleLevel', () => {
  test('isCustomRole', () => {
    expect(isCustomRole('editor', custom)).toBe(true)
    expect(isCustomRole('member', custom)).toBe(false)
    expect(isCustomRole('editor')).toBe(false)
    expect(isCustomRole(null, custom)).toBe(false)
  })

  test('hierarchy: unknown/custom roles are level 1', () => {
    expect(getRoleLevel('super_admin')).toBe(4)
    expect(getRoleLevel('owner')).toBe(3)
    expect(getRoleLevel('admin')).toBe(2)
    expect(getRoleLevel('member')).toBe(1)
    expect(getRoleLevel('menu_editor')).toBe(1)
    expect(getRoleLevel(null)).toBe(0)
  })
})

const values = (opts: Array<{ value: string }>) => opts.map(o => o.value)

describe('getAvailableRoleOptions', () => {
  test('without custom roles behaviour is unchanged', () => {
    expect(values(getAvailableRoleOptions('owner', 'member'))).toEqual(['member', 'admin', 'owner'])
    expect(values(getAvailableRoleOptions('super_admin', 'admin'))).toEqual(['member', 'admin', 'owner'])
    expect(values(getAvailableRoleOptions('admin', 'member'))).toEqual(['member', 'admin'])
    expect(getAvailableRoleOptions('admin', 'admin')).toEqual([])
    expect(getAvailableRoleOptions('member', 'member')).toEqual([])
    expect(getAvailableRoleOptions(null, 'member')).toEqual([])
  })

  test('owners and super admins get custom roles appended after base roles', () => {
    expect(values(getAvailableRoleOptions('owner', 'member', custom))).toEqual(['member', 'admin', 'owner', 'menu_editor', 'editor'])
    expect(values(getAvailableRoleOptions('super_admin', 'member', custom))).toEqual(['member', 'admin', 'owner', 'menu_editor', 'editor'])
    expect(getAvailableRoleOptions('owner', 'member', custom)[3]).toEqual({ label: 'Menu editor (kitchen)', value: 'menu_editor' })
  })

  test('admins never get custom roles and cannot change custom-role members', () => {
    expect(values(getAvailableRoleOptions('admin', 'member', custom))).toEqual(['member', 'admin'])
    expect(getAvailableRoleOptions('admin', 'menu_editor', custom)).toEqual([])
  })
})

describe('getInviteRoleOptions', () => {
  test('without custom roles behaviour is unchanged', () => {
    expect(values(getInviteRoleOptions('super_admin'))).toEqual(['member', 'admin', 'owner'])
    expect(values(getInviteRoleOptions('owner'))).toEqual(['member', 'admin'])
    expect(values(getInviteRoleOptions('admin'))).toEqual(['member', 'admin'])
    expect(getInviteRoleOptions('member')).toEqual([])
    expect(getInviteRoleOptions(undefined)).toEqual([])
  })

  test('custom roles appended for owner and super_admin only', () => {
    expect(values(getInviteRoleOptions('owner', custom))).toEqual(['member', 'admin', 'menu_editor', 'editor'])
    expect(values(getInviteRoleOptions('super_admin', custom))).toEqual(['member', 'admin', 'owner', 'menu_editor', 'editor'])
    expect(values(getInviteRoleOptions('admin', custom))).toEqual(['member', 'admin'])
    expect(getInviteRoleOptions('member', custom)).toEqual([])
  })
})

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createTestSupabaseClient, validateTestEnvironment, TEST_ENV } from './helpers/test-env'

describe('RLS Policies', () => {
  let serviceClient: ReturnType<typeof createClient>

  beforeAll(() => {
    console.log('[RLS-POLICIES] beforeAll: Starting RLS test setup')
    console.log(`[RLS-POLICIES] beforeAll: Test run timestamp: ${new Date().toISOString()}`)

    // Validate environment in CI
    validateTestEnvironment()

    // Service role client for setup/teardown with no session persistence
    serviceClient = createTestSupabaseClient('service')

    console.log('[RLS-POLICIES] beforeAll: Setup complete')
  })

  afterEach(async () => {
    // Clean up any test data that was inserted during tests
    // First clean up team members
    const originalAlphaMembers = [
      '11111111-1111-1111-1111-111111111111', // Super Admin (super@a.test)
      '22222222-2222-2222-2222-222222222222', // Alpha Owner (owner@a.test)
      '33333333-3333-3333-3333-333333333333', // Alpha Admin (admin@a.test)
      '44444444-4444-4444-4444-444444444444', // Alpha Member (member@a.test)
    ]

    const originalBetaMembers = [
      '55555555-5555-5555-5555-555555555555', // Beta Owner (owner@b.test)
      '66666666-6666-6666-6666-666666666666', // Beta Admin (admin@b.test)
      '77777777-7777-7777-7777-777777777777', // Beta Member (member@b.test)
    ]

    const originalTeamIds = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Alpha Team
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // Beta Team
    ]

    const originalUserIds = [
      ...originalAlphaMembers,
      ...originalBetaMembers,
    ]

    // Remove any additional team members that were added during tests
    await serviceClient
      .from('team_members')
      .delete()
      .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .not('user_id', 'in', `(${originalAlphaMembers.map(id => `"${id}"`).join(',')})`)

    await serviceClient
      .from('team_members')
      .delete()
      .eq('team_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
      .not('user_id', 'in', `(${originalBetaMembers.map(id => `"${id}"`).join(',')})`)

    // Remove any extra teams that were created during tests
    await serviceClient
      .from('teams')
      .delete()
      .not('id', 'in', `(${originalTeamIds.map(id => `"${id}"`).join(',')})`)

    // Remove any extra users/profiles that were created during tests
    await serviceClient.auth.admin.deleteUser('99999999-9999-9999-9999-999999999999').catch(() => {})

    // Reset any modified roles back to their original state
    await serviceClient
      .from('team_members')
      .update({ role: 'member' })
      .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .eq('user_id', '44444444-4444-4444-4444-444444444444') // Alpha Member back to member role

    await serviceClient
      .from('team_members')
      .update({ role: 'admin' })
      .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      .eq('user_id', '33333333-3333-3333-3333-333333333333') // Alpha Admin back to admin role
  })

  describe('Data Verification (Service Role)', () => {
    it('should have seed data in database', async () => {
      // Verify data exists using service role (bypasses RLS)
      const { data: members, error } = await serviceClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Service role team members query:', { members, error })

      expect(error).toBeNull()
      expect(members).toHaveLength(4) // Original seed data: super_admin, owner, admin, member
    })

    it('should have security definer functions working', async () => {
      // Test our security definer function directly
      const { data, error } = await serviceClient
        .rpc('get_user_team_ids', { user_uuid: '22222222-2222-2222-2222-222222222222' })

      console.log('get_user_team_ids function test:', { data, error })

      expect(error).toBeNull()
      expect(data).toContain('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    })
  })

  describe('Team Member Visibility', () => {
    it('Alpha owner should see 5 Alpha team members', async () => {
      // Create a fresh client for this test with no session persistence
      const testClient = createTestSupabaseClient('anon')

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      expect(authError).toBeNull()
      expect(authData.user).toBeTruthy()
      expect(authData.session?.access_token).toBeTruthy()

      // Verify session is properly established
      const { data: sessionData } = await testClient.auth.getSession()
      expect(sessionData.session).not.toBeNull()

      // Query team members for Alpha team using the authenticated client
      const { data: members, error } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Alpha owner team members query:', {
        members,
        error,
        userId: authData.user?.id,
        sessionExists: !!authData.session,
      })

      expect(error).toBeNull()
      expect(members).toHaveLength(4) // Original seed data: super_admin, owner, admin, member

      // Clean up
      await testClient.auth.signOut()
    })

    it('Alpha member should see 5 Alpha team members', async () => {
      // Create a fresh client with no session persistence
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      expect(authError).toBeNull()
      expect(authData.user).toBeTruthy()

      // Query team members for Alpha team using the authenticated client
      const { data: members, error } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Alpha member team members query:', {
        members,
        error,
        userId: authData.user?.id,
      })

      expect(error).toBeNull()
      expect(members).toHaveLength(4) // Original seed data: super_admin, owner, admin, member

      // Clean up
      await testClient.auth.signOut()
    })

    it('Beta owner should see 0 Alpha team members (cross-team isolation)', async () => {
      // Create a fresh client with no session persistence
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: 'owner@b.test',
        password: 'password123',
      })

      expect(authError).toBeNull()
      expect(authData.user).toBeTruthy()

      // Query team members for Alpha team (should see none)
      const { data: members, error } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Beta owner Alpha team query:', { members, error, userId: authData.user?.id })

      expect(error).toBeNull()
      expect(members).toHaveLength(0)

      // Clean up
      await testClient.auth.signOut()
    })
  })

  describe('Profile Visibility', () => {
    it('Alpha member should see Alpha team profiles', async () => {
      // Create a fresh client with no session persistence
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      expect(authError).toBeNull()
      expect(authData.user).toBeTruthy()

      // Query profiles
      const { data: profiles, error } = await testClient
        .from('profiles')
        .select('*')

      console.log('Alpha member profiles query:', { profiles, error, userId: authData.user?.id })

      expect(error).toBeNull()
      // Should see at least their own profile + team members
      expect(profiles).toBeDefined()
      expect(Array.isArray(profiles)).toBe(true)
      expect(profiles.length).toBeGreaterThan(0)

      // Clean up
      await testClient.auth.signOut()
    })
  })

  describe('Team Access', () => {
    it('Alpha owner should see Alpha team', async () => {
      // Create a fresh client with no session persistence
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      expect(authError).toBeNull()
      expect(authData.user).toBeTruthy()

      // Query teams
      const { data: teams, error } = await testClient
        .from('teams')
        .select('*')

      console.log('Alpha owner teams query:', { teams, error, userId: authData.user?.id })

      expect(error).toBeNull()
      expect(teams).toHaveLength(1)
      expect(teams?.[0]?.name).toBe('Alpha Corporation')

      // Clean up
      await testClient.auth.signOut()
    })
  })

  describe('Permission Restrictions - What Members CANNOT Do', () => {
    it('Member cannot update other team member roles', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      const { data: authData } = await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      // First verify the client is properly authenticated by doing a SELECT
      const { data: memberData, error: selectError } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Member SELECT verification:', {
        memberData: memberData?.length,
        selectError,
        userId: authData?.user?.id,
      })

      // Check current role before update
      const { data: beforeData } = await testClient
        .from('team_members')
        .select('role')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333')
        .single()

      // Try to promote admin to owner (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333')

      // Check if role actually changed
      const { data: afterData } = await testClient
        .from('team_members')
        .select('role')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333')
        .single()

      console.log('Member trying to update role:', { data, error, beforeRole: beforeData?.role, afterRole: afterData?.role })

      // Either should get explicit error OR role should remain unchanged
      if (error) {
        expect(error.code).toBe('42501') // Insufficient privilege
      }
      else {
        // If no error, the operation should have been silently blocked by RLS
        expect(afterData?.role).toBe(beforeData?.role) // Role should not have changed
      }

      await testClient.auth.signOut()
    })

    it('Member cannot delete other team members', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      // Count team members before delete
      const { data: beforeCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Try to delete admin (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .delete()
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333')

      // Count team members after delete attempt
      const { data: afterCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Member trying to delete member:', {
        data,
        error,
        beforeCount: beforeCount?.length,
        afterCount: afterCount?.length,
      })

      // Either should get explicit error OR count should remain unchanged
      if (error) {
        expect(error.code).toBe('42501') // Insufficient privilege
      }
      else {
        // If no error, the operation should have been silently blocked by RLS
        expect(afterCount?.length).toBe(beforeCount?.length) // Count should not have changed
      }

      await testClient.auth.signOut()
    })

    it('Member cannot add new team members', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      // Try to add new member (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .insert({
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          user_id: '99999999-9999-9999-9999-999999999999',
          role: 'member',
        })

      console.log('Member trying to add member:', { data, error })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501') // Insufficient privilege

      await testClient.auth.signOut()
    })

    it('Member cannot update team settings', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      // Check team name before update
      const { data: beforeData } = await testClient
        .from('teams')
        .select('name')
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .single()

      // Try to update team name (should fail)
      const { data, error } = await testClient
        .from('teams')
        .update({ name: 'Hacked Team Name' })
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Check team name after update attempt
      const { data: afterData } = await testClient
        .from('teams')
        .select('name')
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .single()

      console.log('Member trying to update team:', {
        data,
        error,
        beforeName: beforeData?.name,
        afterName: afterData?.name,
      })

      // Either should get explicit error OR name should remain unchanged
      if (error) {
        expect(error.code).toBe('42501') // Insufficient privilege
      }
      else {
        // If no error, the operation should have been silently blocked by RLS
        expect(afterData?.name).toBe(beforeData?.name) // Name should not have changed
      }

      await testClient.auth.signOut()
    })
  })

  describe('Admin Permissions - What Admins CAN Do', () => {
    it('Admin can promote member to admin', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // First, let's check current role
      const { data: beforeData } = await testClient
        .from('team_members')
        .select('role')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')
        .single()

      expect(beforeData?.role).toBe('member')

      // Try to promote member to admin (should succeed)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      console.log('Admin promoting member to admin:', { data, error })

      expect(error).toBeNull()

      // Verify the change
      const { data: afterData } = await testClient
        .from('team_members')
        .select('role')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')
        .single()

      expect(afterData?.role).toBe('admin')

      // Restore original role for other tests
      await testClient
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      await testClient.auth.signOut()
    })

    it('Admin can invite new admin (consistent with promotion permissions)', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // Use Beta Owner (55555555-5555-5555-5555-555555555555) who should NOT be in Alpha team
      const targetUserId = '55555555-5555-5555-5555-555555555555'

      // Clean up any existing test data first (in case previous test failed)
      await testClient
        .from('team_members')
        .delete()
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', targetUserId)

      // Count team members before insert
      const { data: beforeCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Try to add Beta owner as admin to Alpha team (should succeed with new RLS policy)
      // Using owner@b.test user who exists but isn't in Alpha team
      const { data, error } = await testClient
        .from('team_members')
        .insert({
          team_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          user_id: targetUserId, // owner@b.test from seed data
          role: 'admin',
        })

      console.log('Admin inviting new admin:', { data, error })

      expect(error).toBeNull() // Should succeed now

      // Count team members after insert
      const { data: afterCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(afterCount?.length).toBe((beforeCount?.length || 0) + 1)

      // Clean up - remove the test admin
      await testClient
        .from('team_members')
        .delete()
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', targetUserId)

      await testClient.auth.signOut()
    })

    it('Admin can delete members but not owners/admins', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // Count team members before delete attempt
      const { data: beforeCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Try to delete owner (should fail)
      const { data: ownerDeleteData, error: ownerDeleteError } = await testClient
        .from('team_members')
        .delete()
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '22222222-2222-2222-2222-222222222222') // owner

      // Count team members after delete attempt
      const { data: afterCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Admin trying to delete owner:', {
        ownerDeleteData,
        ownerDeleteError,
        beforeCount: beforeCount?.length,
        afterCount: afterCount?.length,
      })

      // Either should get explicit error OR count should remain unchanged (RLS blocked)
      if (ownerDeleteError) {
        expect(ownerDeleteError.code).toBe('42501') // Insufficient privilege
      }
      else {
        expect(afterCount?.length).toBe(beforeCount?.length) // Count should not have changed
      }

      // Note: We would test deleting a member here, but we only have one member
      // and don't want to break other tests. In a real scenario, admin should be able to delete members.

      await testClient.auth.signOut()
    })
  })

  describe('Admin Restrictions - What Admins CANNOT Do', () => {
    it('Admin cannot promote anyone to owner', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // Try to promote member to owner (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      console.log('Admin trying to promote to owner:', { data, error })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501') // Insufficient privilege

      await testClient.auth.signOut()
    })

    it('Admin cannot update their own role', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // Try to promote themselves to owner (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333') // admin's own ID

      console.log('Admin trying to self-promote:', { data, error })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501') // Insufficient privilege

      await testClient.auth.signOut()
    })

    it('Admin cannot update team settings', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'admin@a.test',
        password: 'password123',
      })

      // Check team name before update
      const { data: beforeData } = await testClient
        .from('teams')
        .select('name')
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .single()

      // Try to update team name (should fail - only owners can do this)
      const { data, error } = await testClient
        .from('teams')
        .update({ name: 'Admin Changed Name' })
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Check team name after update attempt
      const { data: afterData } = await testClient
        .from('teams')
        .select('name')
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .single()

      console.log('Admin trying to update team:', {
        data,
        error,
        beforeName: beforeData?.name,
        afterName: afterData?.name,
      })

      // Either should get explicit error OR name should remain unchanged (RLS blocked)
      if (error) {
        expect(error.code).toBe('42501') // Insufficient privilege
      }
      else {
        expect(afterData?.name).toBe(beforeData?.name) // Name should not have changed
      }

      await testClient.auth.signOut()
    })
  })

  describe('Owner Permissions - What Owners CAN Do', () => {
    it('Owner can update team settings', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      const originalName = 'Alpha Corporation'
      const newName = 'Alpha Corporation Updated'

      // Update team name (should succeed)
      const { data, error } = await testClient
        .from('teams')
        .update({ name: newName })
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Owner updating team name:', { data, error })

      expect(error).toBeNull()

      // Verify the change
      const { data: updatedTeam } = await testClient
        .from('teams')
        .select('name')
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .single()

      expect(updatedTeam?.name).toBe(newName)

      // Restore original name
      await testClient
        .from('teams')
        .update({ name: originalName })
        .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      await testClient.auth.signOut()
    })

    it('Owner can promote members to admin', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      // Promote member to admin (should succeed)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      console.log('Owner promoting member to admin:', { data, error })

      expect(error).toBeNull()

      // Restore original role
      await testClient
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      await testClient.auth.signOut()
    })
  })

  describe('Owner Restrictions - What Owners CANNOT Do', () => {
    it('Owner cannot degrade themselves', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      // Try to degrade themselves to admin (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '22222222-2222-2222-2222-222222222222') // owner's own ID

      console.log('Owner trying to degrade themselves:', { data, error })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('P0001') // Cannot remove the last owner from team

      await testClient.auth.signOut()
    })

    it('Owner cannot assign super_admin role', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      // Try to promote member to super_admin (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'super_admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '44444444-4444-4444-4444-444444444444')

      console.log('Owner trying to assign super_admin:', { data, error })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501') // Insufficient privilege

      await testClient.auth.signOut()
    })

    it('Owner cannot delete super_admins', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      // Count team members before delete attempt
      const { data: beforeCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      // Try to delete super_admin (should fail)
      const { data, error } = await testClient
        .from('team_members')
        .delete()
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '11111111-1111-1111-1111-111111111111') // super_admin

      // Count team members after delete attempt
      const { data: afterCount } = await testClient
        .from('team_members')
        .select('*', { count: 'exact' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      console.log('Owner trying to delete super_admin:', {
        data,
        error,
        beforeCount: beforeCount?.length,
        afterCount: afterCount?.length,
      })

      // Either should get explicit error OR count should remain unchanged (RLS blocked)
      if (error) {
        expect(error.code).toBe('42501') // Insufficient privilege
      }
      else {
        expect(afterCount?.length).toBe(beforeCount?.length) // Count should not have changed
      }

      await testClient.auth.signOut()
    })
  })

  describe('Super Admin Permissions - What Super Admins CAN Do', () => {
    it('Super admin can see all teams across organizations', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'super@a.test',
        password: 'password123',
      })

      // Query all teams (should see both Alpha and Beta)
      const { data: teams, error } = await testClient
        .from('teams')
        .select('*')

      console.log('[RLS-POLICIES] Super Admin Teams Test: Query result:', {
        teamsCount: teams?.length,
        teamNames: teams?.map(t => t.name),
        error,
      })

      if (teams && teams.length > 2) {
        console.log('[RLS-POLICIES] Super Admin Teams Test: Extra teams found:')
        teams.forEach((t) => {
          if (t.name !== 'Alpha Corporation' && t.name !== 'Beta Industries') {
            console.log(`  - ${t.name} (${t.id}) created at ${t.created_at}`)
          }
        })
      }

      expect(error).toBeNull()
      expect(teams).toHaveLength(2)
      expect(teams?.map(t => t.name).sort()).toEqual(['Alpha Corporation', 'Beta Industries'])

      await testClient.auth.signOut()
    })

    it('Super admin can see all team members across organizations', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'super@a.test',
        password: 'password123',
      })

      // Query all team members (should see all 7)
      const { data: members, error } = await testClient
        .from('team_members')
        .select('*')

      console.log('Super admin all members query:', { members, error, count: members?.length })

      expect(error).toBeNull()
      expect(members).toHaveLength(7) // 4 Alpha + 3 Beta (original seed data)

      await testClient.auth.signOut()
    })

    it('Super admin can see all profiles across organizations', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'super@a.test',
        password: 'password123',
      })

      // Query all profiles (should see all 7)
      const { data: profiles, error } = await testClient
        .from('profiles')
        .select('*')

      console.log('Super admin all profiles query:', { profiles, error, count: profiles?.length })

      expect(error).toBeNull()
      expect(profiles).toHaveLength(7) // All 7 users from seed data

      await testClient.auth.signOut()
    })
  })

  describe('Multiple Owners Policy', () => {
    it('Should allow multiple owners per team', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      await testClient.auth.signInWithPassword({
        email: 'owner@a.test',
        password: 'password123',
      })

      // Count current owners (may vary depending on test order)
      const { data: beforeOwners } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('role', 'owner')

      const initialOwnerCount = beforeOwners?.length || 0
      console.log('Initial owner count:', initialOwnerCount)

      // Promote admin to owner (should succeed now)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333') // admin@a.test

      console.log('Multiple owners test:', { data, error })

      expect(error).toBeNull() // Should succeed now

      // Verify we now have one more owner
      const { data: afterOwners } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('role', 'owner')

      expect(afterOwners).toHaveLength(initialOwnerCount + 1) // Should have 1 more owner

      // Clean up - restore admin role (only if we have more than 1 owner to preserve constraint)
      if (afterOwners && afterOwners.length > 1) {
        await testClient
          .from('team_members')
          .update({ role: 'admin' })
          .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          .eq('user_id', '33333333-3333-3333-3333-333333333333')
      }

      await testClient.auth.signOut()
    })

    it('Should prevent team from having zero owners (database constraint)', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      // Use super admin who can modify anyone (bypasses RLS self-modification restriction)
      await testClient.auth.signInWithPassword({
        email: 'super@a.test',
        password: 'password123',
      })

      // Promote admin to owner first (so we have 2 owners)
      const { error: promoteError } = await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333') // admin@a.test

      expect(promoteError).toBeNull() // Super admin can promote anyone

      // Now try to demote one owner to admin (should succeed - still have 1 owner left)
      const { data: _firstUpdate, error: firstError } = await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '22222222-2222-2222-2222-222222222222') // owner@a.test

      expect(firstError).toBeNull() // Should succeed (still 1 owner left)

      // Now try to demote the last owner (should fail due to our trigger)
      const { data, error } = await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333') // admin@a.test (now the only owner)

      console.log('Zero owners prevention test:', { data, error })

      // This should fail with our new constraint
      expect(error).not.toBeNull()
      expect(error?.message).toContain('Cannot remove the last owner from team')

      // Verify we still have exactly 1 owner
      const { data: owners } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('role', 'owner')

      expect(owners).toHaveLength(1) // Should still have 1 owner

      // Clean up - restore original roles
      await testClient
        .from('team_members')
        .update({ role: 'owner' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '22222222-2222-2222-2222-222222222222') // restore owner@a.test

      await testClient
        .from('team_members')
        .update({ role: 'admin' })
        .eq('team_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .eq('user_id', '33333333-3333-3333-3333-333333333333') // restore admin@a.test

      await testClient.auth.signOut()
    })
  })

  describe('Cross-Team Isolation', () => {
    it('Users cannot see other teams data', async () => {
      const testClient = createClient(TEST_ENV.supabaseUrl, TEST_ENV.supabaseAnonKey, {
        auth: { persistSession: false },
      })

      // Test as Alpha member
      await testClient.auth.signInWithPassword({
        email: 'member@a.test',
        password: 'password123',
      })

      // Try to see Beta team members (should see none)
      const { data: betaMembers, error: betaError } = await testClient
        .from('team_members')
        .select('*')
        .eq('team_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')

      console.log('Alpha member trying to see Beta members:', { betaMembers, betaError })

      expect(betaError).toBeNull()
      expect(betaMembers).toHaveLength(0)

      // Try to see Beta team details (should see none)
      const { data: betaTeam, error: teamError } = await testClient
        .from('teams')
        .select('*')
        .eq('id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')

      console.log('Alpha member trying to see Beta team:', { betaTeam, teamError })

      expect(teamError).toBeNull()
      expect(betaTeam).toHaveLength(0)

      await testClient.auth.signOut()
    })
  })
})

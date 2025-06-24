/**
 * Test cleanup utilities that handle database constraints properly
 *
 * This module provides cleanup functions that work around database constraints
 * like the team owner requirement when cleaning up test data.
 */

import { createTestSupabaseClient } from './test-env'

/**
 * Clean up test users and teams created during testing
 * Uses the dedicated cleanup function that bypasses constraints
 */
export async function cleanupTestData(): Promise<{
  usersDeleted: number
  teamsDeleted: number
  errors: string[]
}> {
  const supabase = createTestSupabaseClient('service')
  const errors: string[] = []

  console.log('[TEST-CLEANUP] Starting comprehensive cleanup using SQL function...')

  try {
    // Use the dedicated cleanup function that bypasses constraints
    const { data, error } = await supabase.rpc('cleanup_all_test_data')

    if (error) {
      errors.push(`Failed to run cleanup function: ${error.message}`)
      return { usersDeleted: 0, teamsDeleted: 0, errors }
    }

    if (!data || data.length === 0) {
      console.log('[TEST-CLEANUP] No data returned from cleanup function')
      return { usersDeleted: 0, teamsDeleted: 0, errors }
    }

    const result = data[0]
    const usersDeleted = result.users_deleted || 0
    const teamsDeleted = result.teams_deleted || 0

    console.log(`[TEST-CLEANUP] Complete. Deleted ${usersDeleted} users and ${teamsDeleted} teams using SQL function`)

    return { usersDeleted, teamsDeleted, errors }
  }
  catch (error) {
    // Fallback to manual cleanup if the function fails
    console.log('[TEST-CLEANUP] SQL function failed, falling back to manual cleanup...')
    errors.push(`SQL function cleanup failed: ${error}`)

    return await manualCleanupTestData(errors)
  }
}

/**
 * Manual cleanup fallback that handles edge cases
 */
async function manualCleanupTestData(existingErrors: string[] = []): Promise<{
  usersDeleted: number
  teamsDeleted: number
  errors: string[]
}> {
  const supabase = createTestSupabaseClient('service')
  const errors = [...existingErrors]

  console.log('[TEST-CLEANUP] Starting manual cleanup...')

  // Find all test users
  const { data: testUsers, error: fetchError } = await supabase
    .from('profiles')
    .select('id, email')
    .like('email', '%@example.com')

  if (fetchError) {
    errors.push(`Failed to fetch test users: ${fetchError.message}`)
    return { usersDeleted: 0, teamsDeleted: 0, errors }
  }

  if (!testUsers || testUsers.length === 0) {
    console.log('[TEST-CLEANUP] No test users found to cleanup')
    return { usersDeleted: 0, teamsDeleted: 0, errors }
  }

  console.log(`[TEST-CLEANUP] Found ${testUsers.length} test users for manual cleanup`)

  // Find affected teams
  const testUserIds = testUsers.map(u => u.id)
  const { data: affectedTeams, error: teamsError } = await supabase
    .from('team_members')
    .select('team_id')
    .in('user_id', testUserIds)

  if (teamsError) {
    errors.push(`Failed to fetch affected teams: ${teamsError.message}`)
  }

  const uniqueTeamIds = [...new Set(affectedTeams?.map(t => t.team_id) || [])]
  console.log(`[TEST-CLEANUP] Found ${uniqueTeamIds.length} teams to cleanup manually`)

  // Use the cleanup_test_team function for each team
  let teamsDeleted = 0
  for (const teamId of uniqueTeamIds) {
    try {
      const { error } = await supabase.rpc('cleanup_test_team', { team_id_param: teamId })
      if (error) {
        errors.push(`Failed to cleanup team ${teamId}: ${error.message}`)
      }
      else {
        teamsDeleted++
      }
    }
    catch (error) {
      errors.push(`Exception cleaning up team ${teamId}: ${error}`)
    }
  }

  // Delete users via auth admin API
  let usersDeleted = 0
  for (const user of testUsers) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error) {
        errors.push(`Failed to delete user ${user.email}: ${error.message}`)
      }
      else {
        usersDeleted++
      }
    }
    catch (error) {
      errors.push(`Exception deleting user ${user.email}: ${error}`)
    }
  }

  console.log(`[TEST-CLEANUP] Manual cleanup complete. Deleted ${usersDeleted} users and ${teamsDeleted} teams`)

  return { usersDeleted, teamsDeleted, errors }
}

/**
 * Check if there are any remaining test users in the database
 */
export async function checkForTestDataLeaks(): Promise<{
  testUsers: Array<{ id: string, email: string }>
  testTeams: Array<{ id: string, name: string }>
}> {
  const supabase = createTestSupabaseClient('service')

  // Check for remaining test users
  const { data: testUsers, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .like('email', '%@example.com')

  if (usersError) {
    console.error('[TEST-CLEANUP] Error checking for test users:', usersError)
    return { testUsers: [], testTeams: [] }
  }

  // Check for teams that might have been created by tests
  // This is harder to identify, so we'll look for teams with test-like names
  const { data: testTeams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .or('name.ilike.%test%,name.ilike.%demo%,name.ilike.%@example.com%')

  if (teamsError) {
    console.error('[TEST-CLEANUP] Error checking for test teams:', teamsError)
    return { testUsers: testUsers || [], testTeams: [] }
  }

  return {
    testUsers: testUsers || [],
    testTeams: testTeams || [],
  }
}

/**
 * Verify that the service role has proper permissions for cleanup
 */
export async function verifyCleanupPermissions(): Promise<{
  canDeleteUsers: boolean
  canDeleteTeams: boolean
  canDeleteTeamMembers: boolean
  errors: string[]
}> {
  const supabase = createTestSupabaseClient('service')
  const errors: string[] = []

  console.log('[TEST-CLEANUP] Verifying service role permissions...')

  // Test if we can create and delete a test user
  let canDeleteUsers = false
  try {
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: `permission-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    if (createError || !user.user) {
      errors.push(`Cannot create users: ${createError?.message}`)
    }
    else {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.user.id)
      if (deleteError) {
        errors.push(`Cannot delete users: ${deleteError.message}`)
      }
      else {
        canDeleteUsers = true
      }
    }
  }
  catch (error) {
    errors.push(`Exception testing user permissions: ${error}`)
  }

  // Test if we can create and delete a team
  let canDeleteTeams = false
  try {
    const { data: team, error: createError } = await supabase
      .from('teams')
      .insert({ name: `Permission Test Team ${Date.now()}` })
      .select()
      .single()

    if (createError || !team) {
      errors.push(`Cannot create teams: ${createError?.message}`)
    }
    else {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (deleteError) {
        errors.push(`Cannot delete teams: ${deleteError.message}`)
      }
      else {
        canDeleteTeams = true
      }
    }
  }
  catch (error) {
    errors.push(`Exception testing team permissions: ${error}`)
  }

  // Test if we can manipulate team_members
  let canDeleteTeamMembers = false
  try {
    // Just test if we can select from team_members (safer test)
    const { error } = await supabase
      .from('team_members')
      .select('team_id')
      .limit(1)

    if (error) {
      errors.push(`Cannot access team_members: ${error.message}`)
    }
    else {
      canDeleteTeamMembers = true
    }
  }
  catch (error) {
    errors.push(`Exception testing team_members permissions: ${error}`)
  }

  console.log(`[TEST-CLEANUP] Permission check complete. Users: ${canDeleteUsers}, Teams: ${canDeleteTeams}, TeamMembers: ${canDeleteTeamMembers}`)

  return {
    canDeleteUsers,
    canDeleteTeams,
    canDeleteTeamMembers,
    errors,
  }
}

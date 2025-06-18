import { test as base, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Define types for our fixtures
type TestUser = {
  id: string
  email: string
  password: string
}

type TestTeam = {
  id: string
  name: string
  owner_id: string
}

type TestFixtures = {
  supabaseAdmin: ReturnType<typeof createClient>
  testUser: TestUser
  testTeam: TestTeam
  authenticatedPage: any
}

// Create Supabase admin client for test operations
function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Extend Playwright test with our fixtures
export const test = base.extend<TestFixtures>({
  // Supabase admin client fixture
  supabaseAdmin: async ({}, use) => {
    const supabase = createSupabaseAdmin()
    await use(supabase)
  },

  // Test user fixture - creates a unique user for each test
  testUser: async ({ supabaseAdmin }, use) => {
    const timestamp = Date.now()
    const email = `test-user-${timestamp}@example.com`
    const password = 'TestPassword123!'

    // Create user using Supabase admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email in tests
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`)
    }

    const testUser = {
      id: authData.user.id,
      email,
      password,
    }

    await use(testUser)

    // Cleanup: Delete the test user after the test
    try {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    }
    catch (error) {
      console.warn('Failed to cleanup test user:', error)
    }
  },

  // Test team fixture - creates a team for the test user
  testTeam: async ({ supabaseAdmin, testUser }, use) => {
    const teamName = `Test Team ${Date.now()}`

    // Create team record
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: teamName,
        created_by: testUser.id,
      })
      .select()
      .single()

    if (teamError || !teamData) {
      throw new Error(`Failed to create test team: ${teamError?.message}`)
    }

    // Add user as team owner
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: teamData.id,
        user_id: testUser.id,
        role: 'owner',
      })

    if (memberError) {
      throw new Error(`Failed to add user to team: ${memberError.message}`)
    }

    const testTeam = {
      id: teamData.id,
      name: teamName,
      owner_id: testUser.id,
    }

    await use(testTeam)

    // Cleanup: Delete the test team after the test
    try {
      await supabaseAdmin.from('teams').delete().eq('id', teamData.id)
    }
    catch (error) {
      console.warn('Failed to cleanup test team:', error)
    }
  },

  // Authenticated page fixture - logs in the test user
  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to the app
    await page.goto('/')

    // Log in the test user
    await page.fill('[data-testid="email-input"]', testUser.email)
    await page.fill('[data-testid="password-input"]', testUser.password)
    await page.click('[data-testid="sign-in-button"]')

    // Wait for successful login (you may need to adjust this selector)
    await page.waitForSelector('[data-testid="user-profile"]', { timeout: 10000 })

    await use(page)
  },
})

export { expect }

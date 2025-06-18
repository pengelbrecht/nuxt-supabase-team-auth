import { test, expect } from './fixtures'

test.describe('Authentication Flow', () => {
  test('should display sign-in form on homepage', async ({ page }) => {
    await page.goto('/')

    // Check that sign-in form is present
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="sign-in-button"]')).toBeVisible()
  })

  test('should sign up with team creation', async ({ page, supabaseAdmin }) => {
    await page.goto('/')

    // Click sign up tab/link
    await page.click('[data-testid="sign-up-tab"]')

    // Fill in sign up form
    const timestamp = Date.now()
    const email = `e2e-signup-${timestamp}@example.com`
    const password = 'TestPassword123!'
    const teamName = `E2E Test Team ${timestamp}`

    await page.fill('[data-testid="signup-email-input"]', email)
    await page.fill('[data-testid="signup-password-input"]', password)
    await page.fill('[data-testid="team-name-input"]', teamName)

    await page.click('[data-testid="sign-up-button"]')

    // Wait for successful signup and redirect
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 10000 })

    // Verify team was created
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('name', teamName)

    expect(teams).toHaveLength(1)

    // Cleanup
    if (teams && teams[0]) {
      await supabaseAdmin.from('teams').delete().eq('id', teams[0].id)
    }
  })

  test('should sign in existing user', async ({ page, testUser }) => {
    await page.goto('/')

    // Fill in sign-in form
    await page.fill('[data-testid="email-input"]', testUser.email)
    await page.fill('[data-testid="password-input"]', testUser.password)

    await page.click('[data-testid="sign-in-button"]')

    // Wait for successful login
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 10000 })
  })

  test('should display error for invalid credentials', async ({ page }) => {
    await page.goto('/')

    // Fill in invalid credentials
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')

    await page.click('[data-testid="sign-in-button"]')

    // Check for error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')
  })

  test('should sign out user', async ({ authenticatedPage }) => {
    // Click user profile menu
    await authenticatedPage.click('[data-testid="user-profile"]')

    // Click sign out
    await authenticatedPage.click('[data-testid="sign-out-button"]')

    // Should redirect to sign-in page
    await expect(authenticatedPage.locator('[data-testid="email-input"]')).toBeVisible()
  })
})

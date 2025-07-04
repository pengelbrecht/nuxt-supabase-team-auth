import { test, expect } from '@playwright/test'
import { TestCleanup } from './helpers/cleanup'

test.describe('Environment Variables', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })
  test.describe('With all required env vars', () => {
    test('all features work with minimal env vars', async ({ page }) => {
      // This test runs with our current .env setup:
      // SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

      // Test basic auth works
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Test server-side features work (they depend on SUPABASE_SERVICE_ROLE_KEY)
      await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
      await expect(page.locator('text=owner@a.test')).toBeVisible()
      await expect(page.locator('text=Alpha Corporation')).toBeVisible()

      // Test team members load (server API call)
      await expect(page.locator('text=Total members:')).toBeVisible()

      // Test sign out works
      await page.click('header button:has-text("Alpha Owner")')
      await page.click('text=Sign Out')
      await page.waitForURL('/')
      await expect(page.locator('header')).toContainText('Sign In')
    })

    test('server API endpoints work', async ({ page }) => {
      // Test that server-side operations work with minimal env vars
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'admin@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Try to open team management (tests server API calls)
      await page.click('button:has-text("Manage Team")')

      // Should load team members dialog without errors
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('[role="dialog"] h2:has-text("Team Members")')).toBeVisible()

      // Should show team members (from server API)
      await expect(page.locator('[role="dialog"]').locator('text=Alpha Owner')).toBeVisible()
      await expect(page.locator('[role="dialog"]').locator('text=Alpha Admin')).toBeVisible()

      // Close dialog
      await page.keyboard.press('Escape')
    })
  })

  test.describe('Error handling', () => {
    test('shows helpful error messages', async ({ page }) => {
      // Navigate to a page that would trigger server-side operations
      await page.goto('/signin')

      // Test login flow - any server errors should be handled gracefully
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'nonexistent@test.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      await page.click('button[type="submit"]')

      // Should show user-friendly error, not expose env var issues
      await expect(page.locator('.bg-default:has-text("Sign In Failed")')).toBeVisible()

      // Should not show raw error messages about missing env vars
      await expect(page.locator('text=SUPABASE_SERVICE_ROLE_KEY')).not.toBeVisible()
      await expect(page.locator('text=Missing Supabase')).not.toBeVisible()
    })

    test('navigation works even with potential server issues', async ({ page }) => {
      // Test that client-side navigation works regardless of server state
      await page.goto('/')

      // Should be able to navigate to auth pages
      await page.click('text=Sign In')
      await expect(page).toHaveURL(/.*signin.*/)

      await page.click('text=Sign Up')
      await expect(page).toHaveURL(/.*signup.*/)

      // Should show forms even if there are server connectivity issues
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[name="password"]')).toBeVisible()
    })
  })

  test.describe('Performance with minimal setup', () => {
    test('pages load quickly with minimal env vars', async ({ page }) => {
      const startTime = Date.now()

      // Test that pages load reasonably fast
      await page.goto('/')
      const homeLoadTime = Date.now() - startTime
      expect(homeLoadTime).toBeLessThan(6000) // Should load in under 6 seconds

      const signInStartTime = Date.now()
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]')
      const signInLoadTime = Date.now() - signInStartTime
      expect(signInLoadTime).toBeLessThan(3000) // Should load in under 3 seconds

      const dashboardStartTime = Date.now()
      // Quick login to test dashboard load time
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')
      await page.waitForSelector('h1:has-text("Welcome to Dashboard")')
      const dashboardLoadTime = Date.now() - dashboardStartTime
      expect(dashboardLoadTime).toBeLessThan(8000) // Dashboard with data should load in under 8 seconds
    })
  })
})

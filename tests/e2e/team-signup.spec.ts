import { test, expect } from '@playwright/test'
import { TestCleanup } from './helpers/cleanup'

test.describe('Team Signup', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })

  // Clean up test data after all tests
  test.afterAll(async () => {
    await TestCleanup.cleanupTestData()
  })

  test('signup page loads correctly', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup')

    // Verify we're on signup page
    await expect(page.locator('h2').first()).toContainText('Create your account')

    // Verify form elements are present
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('can navigate to signup from signin', async ({ page }) => {
    // Start at signin page
    await page.goto('/signin')

    // Look for signup link
    await page.click('text=Sign Up')

    // Should be on signup page
    await page.waitForURL('/signup')
    await expect(page.locator('h2').first()).toContainText('Create your account')
  })

  test('signup form requires authentication fields', async ({ page }) => {
    await page.goto('/signup')

    // Wait for form to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    // Try to submit without filling anything - form should prevent submission
    await page.click('button[type="submit"]')

    // Should stay on signup page (form validation prevents submission)
    await expect(page).toHaveURL(/.*signup.*/)
  })
})

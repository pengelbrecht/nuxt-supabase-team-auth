import { test, expect } from '@playwright/test'
import { TestCleanup } from './helpers/cleanup'

test.describe('Authentication', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })

  // Clean up test data after all tests
  test.afterAll(async () => {
    await TestCleanup.cleanupTestData()
  })
  test('can login with existing test user', async ({ page }) => {
    // Navigate to sign in page
    await page.goto('/signin')

    // Verify we're on the sign in page
    await expect(page.locator('h2')).toContainText('Sign in to your account')

    // Fill in login form with test user from seed.sql
    // Wait for the AuthSignIn component to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'owner@a.test')
    await page.fill('input[type="password"]', 'password123')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 })

    // Verify we're logged in by checking for dashboard content
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')

    // Check that UserButton is visible in header (when signed in)
    await expect(page.locator('header')).toContainText('Alpha Owner')

    // Verify we can see user info on dashboard
    await expect(page.locator('text=owner@a.test')).toBeVisible()
    await expect(page.locator('text=Alpha Corporation')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    // Navigate to sign in page
    await page.goto('/signin')

    // Wait for form to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')

    // Submit the form
    await page.click('button[type="submit"]')

    // Should show error message (UToast notification) - target the toast container
    await expect(page.locator('.bg-default:has-text("Sign In Failed")')).toBeVisible()
    await expect(page).toHaveURL(/.*signin.*/)
  })

  test('can logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/signin')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'owner@a.test')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Click user button to open dropdown menu
    await page.click('header button:has-text("Alpha Owner")')

    // Click logout (should be "Sign Out" in the dropdown)
    await page.click('text=Sign Out')

    // Should redirect to home page and show signed out state
    await page.waitForURL('/', { timeout: 10000 })

    // Should see "Sign In" and "Sign Up" buttons in header (signed out state)
    await expect(page.locator('header')).toContainText('Sign In')
    await expect(page.locator('header')).toContainText('Sign Up')
  })
})

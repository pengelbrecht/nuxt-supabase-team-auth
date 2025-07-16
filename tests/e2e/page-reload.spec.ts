import { test, expect } from '@playwright/test'
import { TestCleanup, TestActions } from './helpers/cleanup'

test.describe('Page Reload Authentication', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })

  test('maintains authentication after page reload', async ({ page }) => {
    // Login first
    await TestActions.login(page, 'owner@a.test', 'password123')

    // Verify we're logged in
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    await expect(page.locator('text=owner@a.test')).toBeVisible()

    // Reload the page
    await page.reload()

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Verify we're STILL logged in (not redirected to login)
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    await expect(page.locator('text=owner@a.test')).toBeVisible()
  })

  test('server-side rendering has access to user session', async ({ page }) => {
    // Login first
    await TestActions.login(page, 'owner@a.test', 'password123')

    // Navigate to a fresh page (forces SSR)
    await page.goto('/dashboard', { waitUntil: 'networkidle' })

    // Should still be logged in
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    await expect(page.locator('text=owner@a.test')).toBeVisible()

    // Check that user data is present (indicates SSR had session access)
    await expect(page.locator('text=Alpha Corporation')).toBeVisible()
  })
})

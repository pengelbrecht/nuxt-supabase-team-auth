import { test, expect } from '@playwright/test'
import { TestCleanup, TestActions } from './helpers/cleanup'

test.describe('Impersonation', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })

  test('super admin can impersonate users', async ({ page }) => {
    // Login as super admin (super@a.test from seed.sql)
    await TestActions.login(page, 'super@a.test', 'password123')

    // Verify we're logged in as super admin
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    await expect(page.locator('header')).toContainText('Super Admin')

    // Click the UserButton in header to open dropdown menu
    await page.click('header button:has-text("Super Admin")')

    // Look for "Start impersonation" menu item in the dropdown
    await expect(page.locator('text=Start impersonation')).toBeVisible()
    await page.click('text=Start impersonation')

    // Should open impersonation dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Enter a reason for impersonation (required field)
    await page.fill('input[name="reason"]', 'Testing impersonation functionality')

    // Click impersonate button for Alpha Owner
    const userRow = page.locator('li').filter({ hasText: 'owner@a.test' })
    await userRow.locator('button', { hasText: 'Impersonate' }).click()

    // Wait for impersonation to start and dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Verify impersonation banner appears with specific text
    await expect(page.locator('text=You are impersonating')).toBeVisible()

    // Verify user context changed to the impersonated user
    await expect(page.locator('header')).toContainText('Alpha Owner')

    // Verify the impersonation banner shows correct information
    await expect(page.locator('text=You are impersonating Alpha Owner')).toBeVisible()

    // Verify time remaining is shown
    await expect(page.locator('text=remaining')).toBeVisible()

    // Stop impersonation by clicking the stop button in banner
    await page.click('button:has-text("Stop Impersonation")')

    // Wait for impersonation to end and banner to disappear
    await expect(page.locator('text=You are impersonating')).not.toBeVisible()

    // Verify we're back to the original super admin user
    await expect(page.locator('header')).toContainText('Super Admin')

    // Verify we're still on the dashboard page and not redirected
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')

    // Verify super admin still has access to impersonation features
    await page.click('header button:has-text("Super Admin")')
    await expect(page.locator('text=Start impersonation')).toBeVisible()
  })

  test('regular users cannot see impersonation features', async ({ page }) => {
    // Login as regular member (member@a.test from seed.sql)
    await TestActions.login(page, 'member@a.test', 'password123')

    // Verify logged in as member
    await expect(page.locator('header')).toContainText('Alpha Member')

    // Click user menu
    await page.click('header button:has-text("Alpha Member")')

    // Should NOT see impersonation option
    await expect(page.locator('text=Start impersonation')).not.toBeVisible()

    // Check dashboard for impersonation controls - should not exist
    await page.goto('/dashboard')
    await expect(page.locator('button:has-text("Impersonate")')).not.toBeVisible()
  })
})

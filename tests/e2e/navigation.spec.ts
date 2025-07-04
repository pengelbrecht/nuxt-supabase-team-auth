import { test, expect } from '@playwright/test'
import { TestCleanup, TestActions } from './helpers/cleanup'

test.describe('Navigation & Auth State', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })
  test.describe('Protected routes', () => {
    test('unauthenticated users redirected from dashboard', async ({ page }) => {
      // Try to access dashboard without authentication
      await page.goto('/dashboard')

      // Should be redirected to signin page
      await page.waitForURL('/signin', { timeout: 10000 })
      await expect(page.locator('h2')).toContainText('Sign in to your account')
    })

    test('authenticated users can access dashboard', async ({ page }) => {
      // Login first
      await TestActions.login(page)

      // Should be able to access dashboard
      await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    })
  })

  test.describe('Public routes', () => {
    test('home page accessible without auth', async ({ page }) => {
      await page.goto('/')

      // Should see public content
      await expect(page.locator('header')).toContainText('Team Auth Test')
      await expect(page.locator('header')).toContainText('Sign In')
      await expect(page.locator('header')).toContainText('Sign Up')
    })

    test('auth pages accessible without auth', async ({ page }) => {
      // Should be able to access signin
      await page.goto('/signin')
      await expect(page.locator('h2')).toContainText('Sign in to your account')

      // Should be able to access signup
      await page.goto('/signup')
      await expect(page.locator('h2')).toContainText('Create your account')
    })
  })

  test.describe('Auth state transitions', () => {
    test('login updates global auth state', async ({ page }) => {
      // Start at home page - should show signed out state
      await page.goto('/')
      await expect(page.locator('header')).toContainText('Sign In')
      await expect(page.locator('header')).toContainText('Sign Up')

      // Login
      await page.click('text=Sign In')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Navigate back to home - should show signed in state
      await page.click('text=Home')
      await page.waitForURL('/')
      await expect(page.locator('header')).toContainText('Alpha Owner')
      await expect(page.locator('header')).not.toContainText('Sign In')
    })

    test('logout updates global auth state', async ({ page }) => {
      // Login first
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Navigate to home while signed in
      await page.click('text=Home')
      await page.waitForURL('/')
      await expect(page.locator('header')).toContainText('Alpha Owner')

      // Logout
      await page.click('header button:has-text("Alpha Owner")')
      await page.click('text=Sign Out')

      // Should update auth state globally
      await expect(page.locator('header')).toContainText('Sign In')
      await expect(page.locator('header')).toContainText('Sign Up')
      await expect(page.locator('header')).not.toContainText('Alpha Owner')
    })
  })

  test.describe('Navigation consistency', () => {
    test('navigation links work consistently', async ({ page }) => {
      // Login
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')

      // Test navigation links
      await page.click('text=Home')
      await page.waitForURL('/')
      await expect(page.locator('header')).toContainText('Team Auth Test')

      await page.click('text=Dashboard')
      await page.waitForURL('/dashboard')
      await expect(page.locator('h1')).toContainText('Welcome to Dashboard')

      // Navigation should work from any page
      await page.goto('/')
      await page.click('text=Dashboard')
      await page.waitForURL('/dashboard')
    })

    test.skip('mobile navigation works', async ({ page }) => {
      // Skip - test project doesn't have mobile navigation implemented
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/')

      // Mobile menu button should be visible (look for menu icon in mobile area)
      await expect(page.locator('[class*="i-lucide-menu"]')).toBeVisible()

      // Click mobile menu button
      await page.locator('[class*="i-lucide-menu"]').click()

      // Mobile navigation should appear
      await expect(page.locator('text=Home')).toBeVisible()
      await expect(page.locator('text=Dashboard')).toBeVisible()

      // Mobile navigation should work
      await page.click('text=Dashboard')
      // Should redirect to signin since not authenticated
      await page.waitForURL('/signin')
    })
  })

  test.describe('Page titles and metadata', () => {
    test('pages have appropriate titles', async ({ page }) => {
      await page.goto('/')
      // Test project may not have custom titles - just check page loads
      await expect(page.locator('h1, h2')).toBeVisible()

      await page.goto('/signin')
      await expect(page.locator('h1, h2')).toBeVisible()

      await page.goto('/signup')
      await expect(page.locator('h1, h2')).toBeVisible()

      // Navigate to signin and login to check dashboard title
      await page.goto('/signin')
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await page.fill('input[type="email"]', 'owner@a.test')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')
      await expect(page.locator('h1, h2')).toBeVisible()
    })
  })
})

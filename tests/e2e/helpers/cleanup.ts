import type { Page } from '@playwright/test'

/**
 * Test cleanup utilities to ensure tests don't interfere with each other
 */

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TestCleanup {
  private static createdEmails: string[] = []
  private static createdTeams: string[] = []

  /**
   * Track an email that was created during testing
   */
  static trackEmail(email: string) {
    this.createdEmails.push(email)
  }

  /**
   * Track a team that was created during testing
   */
  static trackTeam(teamName: string) {
    this.createdTeams.push(teamName)
  }

  /**
   * Sign out the current user
   */
  static async signOut(page: Page) {
    try {
      // Try to go to a page first to make sure we're loaded
      await page.goto('/', { timeout: 5000 })

      // Check if user is signed in by looking for user button
      const userButton = page.locator('header button').filter({ hasText: /Alpha|Beta|Super|Test/ })

      if (await userButton.isVisible({ timeout: 2000 })) {
        await userButton.click()

        // Look for sign out option
        const signOutButton = page.locator('text=Sign Out')
        if (await signOutButton.isVisible({ timeout: 2000 })) {
          await signOutButton.click()
          // Wait for redirect
          await page.waitForURL('/', { timeout: 5000 })
        }
      }
    }
    catch (error) {
      // Ignore errors during cleanup - just try to get to a clean state
      console.log('Cleanup sign out failed:', error)
    }
  }

  /**
   * Clear browser data including localStorage, sessionStorage, cookies
   */
  static async clearBrowserData(page: Page) {
    try {
      await page.evaluate(() => {
        // Clear storage
        localStorage.clear()
        sessionStorage.clear()
      })

      // Clear cookies
      const context = page.context()
      await context.clearCookies()
    }
    catch (error) {
      console.log('Cleanup browser data failed:', error)
    }
  }

  /**
   * Full cleanup - sign out, clear data, reset state
   */
  static async fullCleanup(page: Page) {
    await this.signOut(page)
    await this.clearBrowserData(page)
  }

  /**
   * Clean up test users created during tests
   * This should be run after all tests in a suite
   */
  static async cleanupTestData() {
    if (this.createdEmails.length === 0 && this.createdTeams.length === 0) {
      return
    }

    try {
      // Use dynamic import for Node.js modules in ES context
      const { execSync } = await import('node:child_process')

      // Clean up users by email
      for (const email of this.createdEmails) {
        try {
          execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "DELETE FROM auth.users WHERE email = '${email}'"`, { stdio: 'ignore' })
        }
        catch (error) {
          console.log(`Failed to cleanup user ${email}:`, error)
        }
      }

      // Clean up teams by name
      for (const teamName of this.createdTeams) {
        try {
          execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "DELETE FROM teams WHERE name = '${teamName}'"`, { stdio: 'ignore' })
        }
        catch (error) {
          console.log(`Failed to cleanup team ${teamName}:`, error)
        }
      }

      // Reset tracking arrays
      this.createdEmails = []
      this.createdTeams = []

      console.log('Test data cleanup completed')
    }
    catch (error) {
      console.log('Test data cleanup failed:', error)
    }
  }
}

/**
 * Generate unique test data to avoid conflicts
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TestData {
  private static testRunId = Date.now()

  /**
   * Generate unique email for testing
   */
  static generateEmail(prefix = 'test'): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    const email = `${prefix}${timestamp}${random}@test.com`
    TestCleanup.trackEmail(email)
    return email
  }

  /**
   * Generate unique team name for testing
   */
  static generateTeamName(prefix = 'Test Team'): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    const teamName = `${prefix} ${timestamp}${random}`
    TestCleanup.trackTeam(teamName)
    return teamName
  }

  /**
   * Get test run ID for grouping related test data
   */
  static getTestRunId(): number {
    return this.testRunId
  }
}

/**
 * Common test actions
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TestActions {
  /**
   * Login with existing test user
   */
  static async login(page: Page, email: string = 'owner@a.test', password: string = 'password123') {
    await page.goto('/signin')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
  }

  /**
   * Wait for page to be ready (no loading states)
   */
  static async waitForPageReady(page: Page) {
    // Wait for any loading indicators to disappear
    await page.waitForFunction(() => {
      // Check if there are any loading spinners or disabled states
      const loadingElements = document.querySelectorAll('[aria-busy="true"], .loading, [disabled]')
      return loadingElements.length === 0
    }, { timeout: 10000 })
  }
}

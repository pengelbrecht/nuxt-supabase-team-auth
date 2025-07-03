import { test, expect } from '@playwright/test'
import { TestActions } from './helpers/cleanup'

test.describe('User Button Menu', () => {
  test('admin user can see team management items in user button menu', async ({ page }) => {
    // Login as admin user
    await TestActions.login(page, 'admin@a.test', 'password123')
    
    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    
    // Click the user button to open dropdown menu
    const userButton = page.locator('[aria-label*="User menu"]')
    await expect(userButton).toBeVisible()
    await userButton.click()
    
    // Verify admin-specific menu items are visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'Company Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Team Members' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'User Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible()
    
    console.log('✅ Admin user can see all expected menu items in user button')
  })
  
  test('super admin user can see impersonation items in user button menu', async ({ page }) => {
    // Login as super admin user  
    await TestActions.login(page, 'super@a.test', 'password123')
    
    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    
    // Click the user button to open dropdown menu
    const userButton = page.locator('[aria-label*="User menu"]')
    await expect(userButton).toBeVisible()
    await userButton.click()
    
    // Verify super admin-specific menu items are visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'Start Impersonation' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Company Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Team Members' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'User Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible()
    
    console.log('✅ Super admin user can see all expected menu items including impersonation')
  })
  
  test('regular member cannot see admin items in user button menu', async ({ page }) => {
    // Login as regular member
    await TestActions.login(page, 'member@a.test', 'password123')
    
    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Welcome to Dashboard')
    
    // Click the user button to open dropdown menu
    const userButton = page.locator('[aria-label*="User menu"]')
    await expect(userButton).toBeVisible()
    await userButton.click()
    
    // Verify member-level menu items are visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'User Settings' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible()
    
    // Verify admin items are NOT visible in the dropdown menu
    await expect(page.getByRole('menuitem', { name: 'Company Settings' })).not.toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Team Members' })).not.toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Start Impersonation' })).not.toBeVisible()
    
    console.log('✅ Regular member cannot see admin-only menu items')
  })
})
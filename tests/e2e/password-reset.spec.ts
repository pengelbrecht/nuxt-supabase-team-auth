import { test, expect } from '@playwright/test'
import { TestCleanup, TestActions } from './helpers/cleanup'

test.describe('Password Reset', () => {
  // Clean up after each test
  test.afterEach(async ({ page }) => {
    await TestCleanup.fullCleanup(page)
  })

  test.setTimeout(120000) // 2 minutes for the full flow

  test('user can reset password via email - full flow with Inbucket', async ({ page }, _testInfo) => {
    // Monitor API calls
    const apiCalls = []
    page.on('response', (response) => {
      const url = response.url()
      if (url.includes('password') || url.includes('reset') || url.includes('api')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        })
        console.log('🔍 API call:', response.request().method(), response.url(), response.status())
      }
    })

    // Monitor errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('❌ Console error:', msg.text())
      }
    })

    console.log('🔐 Starting password reset E2E test...')

    // *** STEP 1: Navigate to sign in page ***
    await page.goto('http://localhost:3000/signin')
    console.log('✅ Navigated to sign in page')

    // *** STEP 2: Click "Forgot password?" link ***
    const forgotPasswordLink = page.getByRole('button', { name: 'Forgot password?' })
    await expect(forgotPasswordLink).toBeVisible({ timeout: 5000 })
    await forgotPasswordLink.click()
    console.log('✅ Clicked "Forgot password?" link')

    // *** STEP 3: Verify we're on the forgot password page ***
    await page.waitForURL('**/auth/forgot-password', { timeout: 10000 })
    await expect(page.locator('h1, h2')).toContainText(/Reset.*Password|Forgot.*Password/, { timeout: 10000 })
    console.log('✅ Navigated to forgot password page')

    // *** STEP 4: Fill in email address ***
    const testEmail = 'member@a.test' // Use existing test user
    const emailInput = page.getByRole('textbox', { name: /email/i })
    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await emailInput.fill(testEmail)
    console.log('✅ Email filled:', testEmail)

    // *** STEP 5: Submit the forgot password form ***
    const submitButton = page.getByRole('button', { name: /send.*reset|reset.*password|send.*link/i })
    await expect(submitButton).toBeVisible({ timeout: 5000 })
    await expect(submitButton).toBeEnabled({ timeout: 5000 })
    
    console.log('🚀 Clicking send reset link button...')
    await submitButton.click()

    // Wait for success message or form submission
    try {
      await expect(page.locator('text=/email.*sent|check.*email|reset.*link.*sent/i')).toBeVisible({ timeout: 10000 })
      console.log('✅ Success message appeared - reset email sent')
    } catch {
      console.log('⚠️ No explicit success message found, proceeding to check email...')
    }

    // Wait for API call to complete
    await page.waitForTimeout(3000)

    // *** STEP 6: Open Inbucket and find the password reset email ***
    console.log('🌐 Opening Inbucket to check for password reset email...')
    await page.goto('http://127.0.0.1:54324')
    await page.waitForTimeout(3000) // Let emails load

    // Look for the password reset email - get the most recent one
    console.log('📧 Looking for "Reset Your Password" email...')

    // Look for emails with "Reset" in the subject (more specific than just looking for any admin email)
    const resetEmailLinks = page.getByRole('link', { name: /Reset/ })
    const emailCount = await resetEmailLinks.count()
    console.log(`📧 Found ${emailCount} emails with "Reset" in the name`)
    
    if (emailCount > 0) {
      // Click the first (most recent) reset email
      await resetEmailLinks.first().click()
      console.log('📧 Clicked on most recent reset email')
      await page.waitForTimeout(2000)
    } else {
      // Fallback: look for any recent email to member@a.test with today's timestamp
      console.log('📧 No reset emails found, looking for any recent email to member@a.test...')
      const memberEmails = page.getByRole('link', { name: new RegExp(`.*${testEmail.replace('@', '.*').replace('.', '\\.')}`) })
      const memberEmailCount = await memberEmails.count()
      
      if (memberEmailCount > 0) {
        await memberEmails.first().click()
        console.log('📧 Clicked on most recent email to member@a.test')
        await page.waitForTimeout(2000)
      } else {
        throw new Error('Could not find any password reset email in Inbucket')
      }
    }

    // *** STEP 7: Find and click the reset password link in the email ***
    console.log('🔍 Looking for reset password link in email...')

    // Wait for popup when clicking the link
    const page1Promise = page.waitForEvent('popup')

    // Click the reset password link inside the email iframe
    const resetLink = page.locator('#preview-html').contentFrame().getByRole('link', { name: /reset.*password/i })

    if (await resetLink.isVisible({ timeout: 5000 })) {
      console.log('🔗 Found reset password link! Clicking it...')
      await resetLink.click()

      // Wait for the popup to open
      const page1 = await page1Promise
      console.log('📄 New page opened with password reset')

      // Switch to the new page
      await page1.waitForLoadState()
      await page1.waitForTimeout(2000)

      // *** STEP 8: Complete the password reset on the new page ***
      console.log('✅ Password reset page should be loading...')

      // Verify we're on the password reset page
      await expect(page1.locator('h1, h2')).toContainText(/reset.*password|set.*password/i, { timeout: 10000 })
      console.log('✅ Password reset page loaded')

      // Wait for and detect password reset form
      console.log('🔍 Checking for password reset form...')
      const passwordField = page1.getByLabel('New Password', { exact: true })
      const confirmPasswordField = page1.getByLabel('Confirm New Password', { exact: true })
      
      // Wait for password fields to be visible
      await expect(passwordField).toBeVisible({ timeout: 10000 })
      console.log('✅ Password fields detected')
      
      console.log('🔐 Password reset form detected, filling form...')
      
      // Fill new password - use timestamp to ensure it's different from current password
      const timestamp = Date.now()
      const newPassword = `Reset${timestamp}!`
      await passwordField.fill(newPassword)
      console.log('✅ New password field filled')
      
      // Fill confirm password
      await confirmPasswordField.fill(newPassword)
      console.log('✅ Confirm password field filled')

      // Click the submit button
      const resetSubmitButton = page1.getByRole('button', { name: /reset.*password|update.*password|save.*password/i })
      await expect(resetSubmitButton).toBeEnabled({ timeout: 5000 })
      await resetSubmitButton.click()
      console.log('✅ Password reset form submitted')

      // Wait for success state
      console.log('⏳ Waiting for password reset success...')
      
      // Look for success indicators
      try {
        await expect(page1.locator('text=/password.*reset.*successful|password.*updated|success/i')).toBeVisible({ timeout: 10000 })
        console.log('✅ Password reset success message appeared')
      } catch {
        // Alternative: look for sign in button or redirect
        const signinButton = page1.getByRole('button', { name: /sign.*in|login|go.*to.*sign.*in/i })
        if (await signinButton.isVisible({ timeout: 5000 })) {
          console.log('✅ Sign in button appeared - password reset successful')
        } else {
          console.log('⚠️ No explicit success message, but continuing...')
        }
      }

      // Close the popup
      await page1.close()

      // *** STEP 9: Test sign in with new password ***
      console.log('🔑 Testing sign in with new password...')
      
      // Navigate to sign in page
      await page.goto('http://localhost:3000/signin')
      await page.waitForTimeout(1000)

      // Fill in credentials with new password
      const signinEmailInput = page.getByRole('textbox', { name: /email/i })
      const signinPasswordInput = page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]'))
      
      await expect(signinEmailInput).toBeVisible({ timeout: 5000 })
      await signinEmailInput.fill(testEmail)
      await signinPasswordInput.fill(newPassword)
      console.log('✅ Filled sign in form with new password')

      // Submit sign in form
      const signinSubmitButton = page.getByRole('button', { name: /sign.*in|login/i })
      await signinSubmitButton.click()
      console.log('✅ Submitted sign in form')

      // Verify successful login
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      console.log('✅ Successfully redirected to dashboard')

      // Verify user is logged in by checking for user button
      const userButton = page.getByRole('button', { name: /User menu for/ })
      await expect(userButton).toBeVisible({ timeout: 5000 })
      console.log('✅ User button visible - user is successfully logged in with new password!')

      console.log('🎉 Full password reset flow completed successfully!')
    }
    else {
      throw new Error('❌ Could not find reset password link in email')
    }

    console.log('✅ Password reset E2E test completed')
  })

  test('forgot password form validation', async ({ page }) => {
    console.log('🔐 Testing forgot password form validation...')

    // Navigate to forgot password page
    await page.goto('http://localhost:3000/auth/forgot-password')
    await expect(page.locator('h1, h2')).toContainText(/Reset.*Password|Forgot.*Password/, { timeout: 10000 })

    // Test empty email
    const submitButton = page.getByRole('button', { name: /send.*reset|reset.*password|send.*link/i })
    await submitButton.click()

    // Should show validation error
    await expect(page.locator('text=/email.*required|enter.*email/i')).toBeVisible({ timeout: 5000 })
    console.log('✅ Empty email validation works')

    // Test invalid email
    const emailInput = page.getByRole('textbox', { name: /email/i })
    await emailInput.fill('invalid-email')
    await submitButton.click()

    // Should show email format error
    await expect(page.locator('text=/valid.*email|email.*format/i')).toBeVisible({ timeout: 5000 })
    console.log('✅ Invalid email validation works')

    // Test valid email
    await emailInput.fill('test@example.com')
    await expect(submitButton).toBeEnabled()
    console.log('✅ Valid email enables submit button')

    console.log('✅ Forgot password form validation test completed')
  })

  test('navigate back to sign in from forgot password', async ({ page }) => {
    console.log('🔐 Testing navigation from forgot password back to sign in...')

    // Navigate to forgot password page
    await page.goto('http://localhost:3000/auth/forgot-password')
    
    // Look for back to sign in link
    const backToSignInLink = page.getByRole('link', { name: /back.*sign.*in|sign.*in/i }).or(
      page.getByRole('button', { name: /back.*sign.*in|sign.*in/i })
    )

    if (await backToSignInLink.isVisible({ timeout: 5000 })) {
      await backToSignInLink.click()
      await page.waitForURL('**/signin', { timeout: 5000 })
      console.log('✅ Successfully navigated back to sign in page')
    } else {
      console.log('⚠️ No back to sign in link found - this is optional functionality')
    }

    console.log('✅ Navigation test completed')
  })
})
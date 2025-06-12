import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🎭 Setting up E2E test environment...')
  
  // Start Supabase services if not already running
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)
  
  try {
    // Check if Supabase is running
    console.log('🔍 Checking Supabase status...')
    await execAsync('supabase status')
    console.log('✅ Supabase services are running')
  } catch (error) {
    console.log('🚀 Starting Supabase services...')
    try {
      await execAsync('supabase start')
      console.log('✅ Supabase services started successfully')
    } catch (startError) {
      console.error('❌ Failed to start Supabase services:', startError)
      throw startError
    }
  }
  
  // Reset test database to clean state
  try {
    console.log('🗄️ Resetting test database...')
    await execAsync('supabase db reset --no-confirm')
    console.log('✅ Test database reset successfully')
  } catch (resetError) {
    console.log('⚠️ Database reset failed, continuing anyway:', resetError)
  }
  
  // Optional: Create a browser instance for shared authentication state
  const browser = await chromium.launch()
  await browser.close()
  
  console.log('🎉 E2E test environment setup complete!')
}

export default globalSetup
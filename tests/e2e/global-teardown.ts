import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...')
  
  // Clean up test data
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)
  
  try {
    // Optional: Reset database one more time to clean up test data
    console.log('🗑️ Cleaning up test data...')
    await execAsync('supabase db reset --no-confirm')
    console.log('✅ Test data cleaned up')
  } catch (error) {
    console.log('⚠️ Cleanup failed, but continuing:', error)
  }
  
  console.log('🎭 E2E test environment teardown complete!')
}

export default globalTeardown
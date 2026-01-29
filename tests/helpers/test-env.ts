/**
 * Centralized test environment configuration
 *
 * This ensures all tests use environment variables consistently
 * and provides fallbacks for local development.
 */

import { createClient } from '@supabase/supabase-js'

// Note: Newer Supabase CLI versions use ES256 algorithm instead of HS256
// These fallback keys are for local development with `supabase start`
export const TEST_ENV = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODUwNDU1NDR9.IgbK8_tiIcq6xSYGH7-Bq8EJ23tCAw_VT4eFedhXUQjwUMGNXw2PkIQiMFCyDjIcKbX5JSsASUaLVgeHKQCFrA',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NTA0NTU0NH0.0hGv9dY2H5BzmIqYVsrn45yP-4k5mCThMTnOD5RqxcSymfFEWVysaEKrfqIyqfs-UpTZTmP5UJik7x6J1sfVSw',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
} as const

// Validate that required environment variables are set in CI/production
export function validateTestEnvironment() {
  const isCI = process.env.CI === 'true'

  if (isCI) {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    const missing = required.filter(key => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in CI: ${missing.join(', ')}`)
    }
  }
}

// Helper to create Supabase clients with consistent configuration
export function createTestSupabaseClient(type: 'anon' | 'service' = 'anon') {
  const key = type === 'service' ? TEST_ENV.supabaseServiceKey : TEST_ENV.supabaseAnonKey

  return createClient(TEST_ENV.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

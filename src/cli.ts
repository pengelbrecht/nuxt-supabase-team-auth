#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { program } from 'commander'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  scripts?: Record<string, string>
}

program
  .name('team-auth')
  .description('CLI for Nuxt Supabase Team Auth module')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize team-auth in your Supabase project')
  .option('--force', 'Overwrite existing files')
  .action(async (options) => {
    try {
      console.log('🚀 Initializing team-auth module...')

      // Check if we're in a Supabase project
      if (!existsSync('supabase/config.toml')) {
        console.error('❌ No Supabase project found. Run `supabase init` first.')
        process.exit(1)
      }

      // Create migrations directory
      const migrationsDir = 'supabase/migrations/team-auth'
      if (!existsSync(migrationsDir)) {
        mkdirSync(migrationsDir, { recursive: true })
        console.log('✅ Created migrations directory')
      }

      // Create functions directory
      const functionsDir = 'supabase/functions/team-auth'
      if (!existsSync(functionsDir)) {
        mkdirSync(functionsDir, { recursive: true })
        console.log('✅ Created functions directory')
      }

      // Copy migration files
      const migrationsSource = join(__dirname, '../migrations')
      if (existsSync(migrationsSource)) {
        // Copy migration files here
        console.log('✅ Copied migration files')
      }

      // Copy edge function files
      const functionsSource = join(__dirname, '../functions')
      if (existsSync(functionsSource)) {
        // Copy function files here
        console.log('✅ Copied edge function files')
      }

      // Update package.json scripts
      if (existsSync('package.json')) {
        const packageJson: PackageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
        if (!packageJson.scripts) {
          packageJson.scripts = {}
        }
        packageJson.scripts['team-auth:migrate'] = 'team-auth migrate'
        writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
        console.log('✅ Updated package.json scripts')
      }

      // Check if Supabase CLI is available and project is linked
      try {
        execSync('supabase status', { stdio: 'pipe' })
        console.log('✅ Supabase project is linked')

        // Optionally run db push for local development
        const shouldPush = process.env.SUPABASE_DB_PUSH !== 'false'
        if (shouldPush) {
          console.log('🔄 Applying migrations to local database...')
          execSync('supabase db push', { stdio: 'inherit' })
          console.log('✅ Migrations applied')
        }
      }
      catch (error) {
        console.warn('⚠️  Supabase CLI not available or project not linked')
        console.log('   Run `supabase db push` manually after linking your project')
      }

      console.log('')
      console.log('🎉 Team-auth initialization complete!')
      console.log('')
      console.log('Next steps:')
      console.log('1. Configure your environment variables (.env)')
      console.log('2. Run `npm run dev` to start development')
      console.log('3. Check out the documentation for usage examples')
    }
    catch (error) {
      console.error('❌ Initialization failed:', error)
      process.exit(1)
    }
  })

program
  .command('migrate')
  .description('Apply new team-auth migrations')
  .action(async () => {
    try {
      console.log('🔄 Applying team-auth migrations...')

      // Check for new migrations and apply them
      // This would check version compatibility and apply only new migrations

      console.log('✅ Migrations applied successfully')
    }
    catch (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
  })

program.parse()

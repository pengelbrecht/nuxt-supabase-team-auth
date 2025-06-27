#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { program } from 'commander'

interface PackageJson {
  scripts?: Record<string, string>
}

interface MigrationTracker {
  version: string
  appliedMigrations: string[]
  lastUpdated: string
}

// Helper to find Supabase directory (walks up directory tree like Supabase CLI)
function findSupabaseDir(): string | null {
  const startDir = process.cwd()
  let currentDir = startDir
  const rootDir = '/'
  
  while (currentDir !== rootDir) {
    const supabaseConfigPath = join(currentDir, 'supabase', 'config.toml')
    if (existsSync(supabaseConfigPath)) {
      // Calculate relative path from working directory to supabase dir
      const supabaseDir = join(currentDir, 'supabase')
      const relativePath = relative(startDir, supabaseDir)
      return relativePath || 'supabase'
    }
    
    // Move up one directory
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached root without finding supabase directory
      break
    }
    currentDir = parentDir
  }
  
  return null
}

// Helper to get the module root directory
function getModuleRoot(): string {
  // When running from dist/cli.mjs, we need to go up to find the module root
  const currentPath = fileURLToPath(import.meta.url)
  const distDir = dirname(currentPath)

  // In development, cli.ts is in src/
  // In production, cli.mjs is in dist/
  // The module root contains package.json
  let moduleRoot = dirname(distDir)

  // If we can't find package.json, we might be in development
  if (!existsSync(join(moduleRoot, 'package.json'))) {
    // Try going up one more level (from src to module root)
    moduleRoot = dirname(moduleRoot)
  }

  return moduleRoot
}

// Helper to copy directory recursively
function copyDirectoryRecursive(source: string, target: string, force = false): number {
  let copiedCount = 0

  if (!existsSync(source)) {
    return copiedCount
  }

  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true })
  }

  const entries = readdirSync(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = join(source, entry.name)
    const targetPath = join(target, entry.name)

    if (entry.isDirectory()) {
      copiedCount += copyDirectoryRecursive(sourcePath, targetPath, force)
    }
    else {
      if (!existsSync(targetPath) || force) {
        copyFileSync(sourcePath, targetPath)
        copiedCount++
      }
    }
  }

  return copiedCount
}

// Helper to check for conflicting tables
async function checkTableConflicts(): Promise<string[]> {
  const conflictingTables: string[] = []
  const requiredTables = ['profiles', 'teams', 'team_members', 'impersonation_sessions']

  for (const table of requiredTables) {
    try {
      // Check if table exists in public schema
      const result = execSync(
        `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');"`,
        { stdio: 'pipe' },
      ).toString().trim()

      if (result === 't') {
        conflictingTables.push(table)
      }
    }
    catch {
      // If check fails, continue without blocking
      // This might happen if Supabase isn't running
    }
  }

  return conflictingTables
}

// Helper to load migration tracker
function loadMigrationTracker(): MigrationTracker | null {
  const trackerPath = '.team-auth-version.json'

  if (!existsSync(trackerPath)) {
    return null
  }

  try {
    const content = readFileSync(trackerPath, 'utf-8')
    return JSON.parse(content)
  }
  catch {
    return null
  }
}

// Helper to save migration tracker
function saveMigrationTracker(tracker: MigrationTracker): void {
  const trackerPath = '.team-auth-version.json'
  writeFileSync(trackerPath, JSON.stringify(tracker, null, 2))
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
      const supabaseDir = findSupabaseDir()
      if (!supabaseDir) {
        console.error('❌ No Supabase project found. Run `supabase init` first.')
        console.error('   Searched up directory tree from current working directory')
        process.exit(1)
      }
      
      if (supabaseDir !== 'supabase') {
        console.log(`📁 Found Supabase project at: ${supabaseDir}`)
      }

      // Check if Supabase is running for conflict detection
      let supabaseRunning = false
      try {
        execSync('supabase status', { stdio: 'pipe' })
        supabaseRunning = true
      }
      catch {
        console.warn('⚠️  Supabase not running. Table conflict detection skipped.')
      }

      // Check for conflicting tables if Supabase is running
      if (supabaseRunning) {
        const conflicts = await checkTableConflicts()
        if (conflicts.length > 0) {
          console.log('')
          console.log('⚠️  Found existing tables that may conflict:')
          conflicts.forEach((table) => {
            console.log(`   - public.${table} (existing table)`)
          })
          console.log('')
          console.log('This module requires these tables for team authentication.')
          console.log('Options:')
          console.log('1. Backup and remove existing tables first')
          console.log('2. Use --force to continue anyway (advanced users)')
          console.log('3. See documentation for manual integration')
          console.log('')

          if (!options.force) {
            const confirm = await confirmAction('Continue anyway?')
            if (!confirm) {
              console.log('❌ Initialization cancelled. Please resolve conflicts first.')
              process.exit(0)
            }
          }
        }
        else {
          console.log('✅ No conflicting tables found')
        }
      }

      const moduleRoot = getModuleRoot()
      console.log('📦 Module root:', moduleRoot)

      // Copy migration files
      const migrationsSource = join(moduleRoot, 'supabase', 'migrations')
      const migrationsTarget = join(supabaseDir, 'migrations')

      if (existsSync(migrationsSource)) {
        const copiedMigrations = copyDirectoryRecursive(migrationsSource, migrationsTarget, options.force)
        console.log(`✅ Copied ${copiedMigrations} migration files`)
      }
      else {
        console.warn('⚠️  Migration files not found in module')
      }

      // Copy edge function files
      const functionsSource = join(moduleRoot, 'supabase', 'functions')
      const functionsTarget = join(supabaseDir, 'functions')

      if (existsSync(functionsSource)) {
        const functionDirs = readdirSync(functionsSource, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)

        let copiedFunctions = 0
        functionDirs.forEach((funcName) => {
          const sourceDir = join(functionsSource, funcName)
          const targetDir = join(functionsTarget, funcName)
          copiedFunctions += copyDirectoryRecursive(sourceDir, targetDir, options.force)
        })

        console.log(`✅ Copied ${functionDirs.length} Edge Function directories (${copiedFunctions} files)`)
      }
      else {
        console.warn('⚠️  Edge Function files not found in module')
      }

      // Initialize version tracker
      const packagePath = join(moduleRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))

      // Get list of migration files that were copied
      const appliedMigrations: string[] = []
      if (existsSync(migrationsSource)) {
        const migrationFiles = readdirSync(migrationsSource)
          .filter(file => file.endsWith('.sql'))
          .sort()
        appliedMigrations.push(...migrationFiles)
      }

      const initialTracker: MigrationTracker = {
        version: packageJson.version,
        appliedMigrations,
        lastUpdated: new Date().toISOString(),
      }
      saveMigrationTracker(initialTracker)
      console.log(`✅ Version tracker initialized (v${packageJson.version})`)

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
      catch {
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
  .option('--dry-run', 'Show what would be applied without making changes')
  .action(async (options) => {
    try {
      console.log('🔄 Checking for team-auth migrations...')

      // Check if we're in a Supabase project
      const supabaseDir = findSupabaseDir()
      if (!supabaseDir) {
        console.error('❌ No Supabase project found. Run `supabase init` first.')
        console.error('   Searched up directory tree from current working directory')
        process.exit(1)
      }

      // Load current migration tracker
      const currentTracker = loadMigrationTracker()
      if (!currentTracker) {
        console.error('❌ No migration tracker found. Run `npx nuxt-supabase-team-auth init` first.')
        process.exit(1)
      }

      const moduleRoot = getModuleRoot()
      const modulePackagePath = join(moduleRoot, 'package.json')
      const modulePackageJson = JSON.parse(readFileSync(modulePackagePath, 'utf-8'))

      console.log(`📦 Current version: ${currentTracker.version}`)
      console.log(`📦 Module version: ${modulePackageJson.version}`)

      // Get current module migrations
      const migrationsSource = join(moduleRoot, 'supabase', 'migrations')
      if (!existsSync(migrationsSource)) {
        console.log('✅ No migrations found in module')
        return
      }

      const availableMigrations = readdirSync(migrationsSource)
        .filter(file => file.endsWith('.sql'))
        .sort()

      // Find new migrations that haven't been applied
      const newMigrations = availableMigrations.filter(
        migration => !currentTracker.appliedMigrations.includes(migration),
      )

      if (newMigrations.length === 0) {
        console.log('✅ No new migrations to apply')
        return
      }

      console.log(`📋 Found ${newMigrations.length} new migration(s):`)
      newMigrations.forEach((migration) => {
        console.log(`   - ${migration}`)
      })

      if (options.dryRun) {
        console.log('🔍 Dry run complete - no changes made')
        return
      }

      // Ask for confirmation
      const confirm = await confirmAction('Apply these migrations?')
      if (!confirm) {
        console.log('❌ Migration cancelled')
        process.exit(0)
      }

      // Copy new migration files
      const migrationsTarget = join(supabaseDir, 'migrations')

      for (const migration of newMigrations) {
        const sourcePath = join(migrationsSource, migration)
        const targetPath = join(migrationsTarget, migration)

        if (!existsSync(targetPath)) {
          copyFileSync(sourcePath, targetPath)
          console.log(`✅ Copied ${migration}`)
        }
      }

      // Copy new edge functions if any
      const functionsSource = join(moduleRoot, 'supabase', 'functions')
      const functionsTarget = join('supabase', 'functions')

      if (existsSync(functionsSource)) {
        const functionDirs = readdirSync(functionsSource, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)

        let copiedFunctions = 0
        functionDirs.forEach((funcName) => {
          const sourceDir = join(functionsSource, funcName)
          const targetDir = join(functionsTarget, funcName)
          copiedFunctions += copyDirectoryRecursive(sourceDir, targetDir, true) // Force overwrite for updates
        })

        if (copiedFunctions > 0) {
          console.log(`✅ Updated ${functionDirs.length} Edge Function directories (${copiedFunctions} files)`)
        }
      }

      // Update migration tracker
      const updatedTracker: MigrationTracker = {
        version: modulePackageJson.version,
        appliedMigrations: [...currentTracker.appliedMigrations, ...newMigrations],
        lastUpdated: new Date().toISOString(),
      }
      saveMigrationTracker(updatedTracker)

      // Apply migrations to database if Supabase is running
      try {
        execSync('supabase status', { stdio: 'pipe' })
        console.log('🔄 Applying migrations to local database...')
        execSync('supabase db push', { stdio: 'inherit' })
        console.log('✅ Database updated successfully')
      }
      catch {
        console.warn('⚠️  Supabase not running. Run `supabase db push` manually.')
      }

      console.log('')
      console.log('🎉 Migration complete!')
      console.log(`📦 Updated to version ${modulePackageJson.version}`)
      console.log(`📋 Applied ${newMigrations.length} new migration(s)`)
    }
    catch (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
  })

// Database cleanup commands
program
  .command('cleanup')
  .description('Database cleanup operations for development')
  .option('--all', 'Reset entire database (equivalent to supabase db reset)')
  .option('--test-data', 'Clean only test data (users with @example.com emails)')
  .option('--team <team-id>', 'Delete specific team by ID')
  .action(async (options) => {
    try {
      // Check if we're in a Supabase project
      const supabaseDir = findSupabaseDir()
      if (!supabaseDir) {
        console.error('❌ No Supabase project found. Must be run from Supabase project root.')
        console.error('   Searched up directory tree from current working directory')
        process.exit(1)
      }

      // Check if Supabase is running
      try {
        execSync('supabase status', { stdio: 'pipe' })
      }
      catch {
        console.error('❌ Supabase services not running. Run `supabase start` first.')
        process.exit(1)
      }

      if (options.all) {
        console.log('🗑️  Resetting entire database...')
        console.log('⚠️  This will remove ALL data and reapply migrations.')

        // Ask for confirmation
        const confirm = await confirmAction('Are you sure you want to reset the entire database?')
        if (!confirm) {
          console.log('❌ Database reset cancelled')
          process.exit(0)
        }

        execSync('supabase db reset --debug', { stdio: 'inherit' })
        console.log('✅ Database reset complete')
      }
      else if (options.testData) {
        console.log('🧹 Cleaning test data...')

        try {
          execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT cleanup_all_test_data();"', { stdio: 'inherit' })
          console.log('✅ Test data cleanup complete')
        }
        catch (error) {
          console.error('❌ Test data cleanup failed:', error)
          process.exit(1)
        }
      }
      else if (options.team) {
        const teamId = options.team
        console.log(`🗑️  Deleting team: ${teamId}`)

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(teamId)) {
          console.error('❌ Invalid team ID format. Must be a valid UUID.')
          process.exit(1)
        }

        try {
          execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT cleanup_test_team('${teamId}');"`, { stdio: 'inherit' })
          console.log('✅ Team deletion complete')
        }
        catch (error) {
          console.error('❌ Team deletion failed:', error)
          process.exit(1)
        }
      }
      else {
        console.log('❓ No cleanup option specified. Use --help for available options.')
        console.log('')
        console.log('Available cleanup options:')
        console.log('  --all           Reset entire database')
        console.log('  --test-data     Clean only test data')
        console.log('  --team <id>     Delete specific team')
        process.exit(1)
      }
    }
    catch (error) {
      console.error('❌ Cleanup failed:', error)
      process.exit(1)
    }
  })

// Database status and info commands
program
  .command('db')
  .description('Database status and information')
  .option('--status', 'Show Supabase services status')
  .option('--teams', 'List all teams')
  .option('--users', 'List all users')
  .action(async (options) => {
    try {
      // Check if we're in a Supabase project
      const supabaseDir = findSupabaseDir()
      if (!supabaseDir) {
        console.error('❌ No Supabase project found. Must be run from Supabase project root.')
        console.error('   Searched up directory tree from current working directory')
        process.exit(1)
      }

      if (options.status) {
        console.log('📊 Supabase Services Status:')
        execSync('supabase status', { stdio: 'inherit' })
      }
      else if (options.teams) {
        console.log('👥 Teams in database:')
        execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT id, name, created_at FROM teams ORDER BY created_at;"', { stdio: 'inherit' })
      }
      else if (options.users) {
        console.log('👤 Users in database:')
        execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT p.id, p.full_name, p.email, p.created_at FROM profiles p ORDER BY p.created_at LIMIT 50;"', { stdio: 'inherit' })
      }
      else {
        console.log('❓ No database option specified. Use --help for available options.')
        console.log('')
        console.log('Available database options:')
        console.log('  --status        Show Supabase services status')
        console.log('  --teams         List all teams')
        console.log('  --users         List all users (limited to 50)')
        process.exit(1)
      }
    }
    catch (error) {
      console.error('❌ Database operation failed:', error)
      process.exit(1)
    }
  })

// Helper function for confirmation prompts
async function confirmAction(message: string): Promise<boolean> {
  const readline = await import('node:readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

// Add docs command
program
  .command('docs')
  .description('Open documentation (README)')
  .action(() => {
    const moduleRoot = getModuleRoot()
    const readmePath = join(moduleRoot, 'README.md')
    
    if (existsSync(readmePath)) {
      console.log('📖 Opening documentation...')
      console.log(`📍 README location: ${readmePath}`)
      try {
        // Try to open with system default
        execSync(`open "${readmePath}"`, { stdio: 'ignore' })
      } catch {
        try {
          // Fallback for Linux
          execSync(`xdg-open "${readmePath}"`, { stdio: 'ignore' })
        } catch {
          console.log('💡 View the README at the path above, or visit:')
          console.log('   https://github.com/pengelbrecht/nuxt-supabase-team-auth')
        }
      }
    } else {
      console.log('📖 Documentation: https://github.com/pengelbrecht/nuxt-supabase-team-auth')
    }
  })

program.parse()

import { defineConfig } from 'changelogen'

export default defineConfig({
  // Repository information
  github: {
    repo: 'pengelbrecht/nuxt-supabase-team-auth',
  },

  // Release types and their emoji/titles
  types: {
    feat: { title: '🚀 Features', semver: 'minor' },
    fix: { title: '🐛 Bug Fixes', semver: 'patch' },
    perf: { title: '⚡ Performance', semver: 'patch' },
    refactor: { title: '♻️ Refactors', semver: 'patch' },
    docs: { title: '📖 Documentation', semver: 'patch' },
    build: { title: '📦 Build', semver: 'patch' },
    types: { title: '🌊 Types', semver: 'patch' },
    chore: { title: '🏡 Chore' },
    examples: { title: '🏀 Examples' },
    test: { title: '✅ Tests' },
    style: { title: '🎨 Styles' },
    ci: { title: '🤖 CI' },
  },

  // Commit message patterns to include/exclude
  excludeAuthors: [
    'dependabot[bot]',
    'renovate[bot]',
    'github-actions[bot]',
  ],

  // Output configuration
  output: {
    file: 'CHANGELOG.md',
  },

  // Include breaking changes section
  includeBreaking: true,

  // Include authors in changelog
  includeAuthors: true,

  // Group commits by type
  group: true,

  // Use conventional commits
  conventional: {
    // Custom scopes that should be highlighted
    scopeMap: {
      auth: 'Authentication',
      db: 'Database',
      ui: 'User Interface',
      cli: 'Command Line',
      api: 'API',
      types: 'TypeScript',
      test: 'Testing',
      docs: 'Documentation',
      deps: 'Dependencies',
    },
  },
})

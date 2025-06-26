#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getVersionInfo() {
  const packagePath = path.join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  
  // Get current version from package.json
  const currentVersion = packageJson.version
  
  // Get latest git tag
  let latestTag = 'none'
  try {
    latestTag = execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf8' }).trim()
  } catch (e) {
    // No tags found
  }
  
  // Get current branch
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
  
  // Get commits since last tag (if any)
  let commitsSinceTag = 0
  try {
    if (latestTag !== 'none') {
      const commits = execSync(`git rev-list ${latestTag}..HEAD --count`, { encoding: 'utf8' }).trim()
      commitsSinceTag = parseInt(commits, 10)
    } else {
      const commits = execSync('git rev-list HEAD --count', { encoding: 'utf8' }).trim()
      commitsSinceTag = parseInt(commits, 10)
    }
  } catch (e) {
    // Error getting commit count
  }
  
  // Check if working directory is clean
  let isClean = true
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
    isClean = status === ''
  } catch (e) {
    // Error checking git status
  }
  
  return {
    currentVersion,
    latestTag,
    currentBranch,
    commitsSinceTag,
    isClean,
  }
}

function suggestNextVersion(info) {
  // This is a simple heuristic - in real scenarios you'd analyze commit messages
  if (info.commitsSinceTag === 0) {
    return info.currentVersion // No changes
  }
  
  // Parse current version
  const [major, minor, patch] = info.currentVersion.split('.').map(Number)
  
  return {
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`,
  }
}

function main() {
  console.log('📦 Package Version Information\n')
  
  const info = getVersionInfo()
  const suggestions = suggestNextVersion(info)
  
  console.log(`Current Version: ${info.currentVersion}`)
  console.log(`Latest Git Tag:  ${info.latestTag}`)
  console.log(`Current Branch:  ${info.currentBranch}`)
  console.log(`Commits Since:   ${info.commitsSinceTag}`)
  console.log(`Working Dir:     ${info.isClean ? '✅ Clean' : '⚠️  Modified'}`)
  
  if (info.commitsSinceTag > 0) {
    console.log('\n🎯 Suggested Next Versions:')
    console.log(`  Patch: ${suggestions.patch} (bug fixes)`)
    console.log(`  Minor: ${suggestions.minor} (new features)`)
    console.log(`  Major: ${suggestions.major} (breaking changes)`)
    
    console.log('\n🚀 Release Commands:')
    console.log(`  pnpm run version:patch  # ${suggestions.patch}`)
    console.log(`  pnpm run version:minor  # ${suggestions.minor}`)
    console.log(`  pnpm run version:major  # ${suggestions.major}`)
  } else {
    console.log('\n✨ No commits since last tag - ready for release!')
  }
}

main()
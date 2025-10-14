You are helping to release a new version of the nuxt-supabase-team-auth module to npm and GitHub.

## Release Process

Follow these steps in order:

### 1. Quality Checks
- Run `pnpm run lint` to ensure code passes linting
- Run `pnpm run test` to ensure all unit tests pass
- If either fails, STOP and report the errors to the user

### 2. Git Status Check
- Run `git status` to show what files have changed
- Show the user the changes and ask if they want to proceed

### 3. Commit Changes
- Ask the user for a commit message (suggest based on changes)
- Run `git add .` to stage all changes
- Run `git commit -m "<message>"` with the user's message
- Remember: NEVER add "Co-Authored-By: Claude" to commits (see CLAUDE.md guidelines)

### 4. Version Bump
- Ask the user what type of version bump: **patch**, **minor**, or **major**
  - patch: Bug fixes (0.6.12 → 0.6.13)
  - minor: New features (0.6.12 → 0.7.0)
  - major: Breaking changes (0.6.12 → 1.0.0)
- Run the appropriate command:
  - `npm version patch` for patch
  - `npm version minor` for minor
  - `npm version major` for major
- This will automatically update package.json and create a git tag

### 5. Push to GitHub
- Run `git push` to push commits
- Run `git push --tags` to push the version tag

### 6. Create GitHub Release
- Get the latest version tag: `git describe --tags --abbrev=0`
- Use the `gh release create` command:
  ```bash
  gh release create v<VERSION> --generate-notes --title "v<VERSION>"
  ```
- Example: `gh release create v0.6.13 --generate-notes --title "v0.6.13"`

### 7. Publish to npm
- Run `pnpm run prepack` to build the module
- Run `pnpm publish` to publish to npm registry
- This requires npm authentication - user must be logged in

### 8. Verify Release
- Check that the version appears on npm: `npm view nuxt-supabase-team-auth version`
- Provide the GitHub release URL to the user
- Provide the npm package URL to the user

## Important Notes

- NEVER publish without explicit user permission
- ALWAYS test in `./test-projects/minimal-nuxt-ui-app` before releasing (remind user if not done)
- Follow commit message guidelines from CLAUDE.md (no Claude credits)
- If any step fails, STOP and report the error to the user
- The user must be logged into npm (`npm whoami` to check)

## URLs to Provide After Success

- GitHub Release: `https://github.com/pengelbrecht/nuxt-supabase-team-auth/releases/tag/v<VERSION>`
- npm Package: `https://www.npmjs.com/package/nuxt-supabase-team-auth`

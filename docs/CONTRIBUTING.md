# Contributing to nuxt-supabase-team-auth

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/pengelbrecht/nuxt-supabase-team-auth.git
   cd nuxt-supabase-team-auth
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development server**
   ```bash
   pnpm run dev
   ```

4. **Run tests**
   ```bash
   pnpm run test        # Unit tests
   pnpm run test:e2e    # E2E tests
   pnpm run test:types  # Type checking
   ```

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages and automated changelog generation.

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation only changes
- **style**: Changes that do not affect code meaning (formatting, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes affecting build system or dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

### Scopes (optional)
- **auth**: Authentication related changes
- **db**: Database schema or migrations
- **ui**: User interface components
- **cli**: Command line interface
- **api**: API endpoints or server routes
- **types**: TypeScript type definitions
- **test**: Testing utilities or configurations
- **docs**: Documentation
- **deps**: Dependencies

### Examples
```bash
# New feature
feat(auth): add Google OAuth provider support

# Bug fix
fix(ui): resolve modal dialog positioning issue

# Breaking change
feat(api)!: redesign team invitation API

BREAKING CHANGE: The invitation API now requires explicit team context
```

### Breaking Changes
For breaking changes, add `!` after the type/scope and include `BREAKING CHANGE:` in the footer:

```
feat(api)!: redesign authentication flow

BREAKING CHANGE: The authentication API now requires explicit team context in all requests
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Run quality checks**
   ```bash
   pnpm run lint        # Fix linting issues
   pnpm run test        # Ensure tests pass
   pnpm run test:types  # Check TypeScript types
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): your commit message"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style Guidelines

- **TypeScript**: We use TypeScript for type safety
- **ESLint**: Follow the configured linting rules
- **Formatting**: Code is automatically formatted on commit
- **Testing**: Maintain test coverage for new features
- **Documentation**: Update docs for user-facing changes

## Testing Guidelines

### Unit Tests
- Write tests for all new functionality
- Mock external dependencies appropriately
- Use descriptive test names and structure

### E2E Tests
- Test critical user flows
- Focus on integration scenarios
- Keep tests stable and maintainable

### Database Tests
- Use test database helpers
- Clean up test data between tests
- Test RLS policies and security

## Release Process

Releases are automated through GitHub Actions:

1. **Version Bump**: Use semantic versioning
   ```bash
   pnpm run version:patch  # Bug fixes
   pnpm run version:minor  # New features
   pnpm run version:major  # Breaking changes
   ```

2. **Push Tags**: Triggers automated release
   ```bash
   git push --follow-tags
   ```

3. **Automation**: GitHub Actions handles:
   - Building and testing
   - Generating changelog
   - Creating GitHub release
   - Publishing to NPM

## Getting Help

- **Issues**: [Report bugs or request features](https://github.com/pengelbrecht/nuxt-supabase-team-auth/issues)
- **Discussions**: [Ask questions or get help](https://github.com/pengelbrecht/nuxt-supabase-team-auth/discussions)
- **Documentation**: [Read the docs](https://github.com/pengelbrecht/nuxt-supabase-team-auth#readme)

## Code of Conduct

Please be respectful and inclusive in all interactions. We're committed to providing a welcoming environment for all contributors.
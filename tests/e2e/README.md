# End-to-End Testing with Playwright

This directory contains E2E tests for the nuxt-supabase-team-auth module using Playwright.

## Setup

1. **Install Dependencies**
   ```bash
   pnpm install
   npx playwright install
   ```

2. **Start Supabase Services**
   ```bash
   supabase start
   ```

3. **Run Tests**
   ```bash
   # Run all E2E tests
   npm run test:e2e
   
   # Run with UI (recommended for development)
   npm run test:e2e:ui
   
   # Run in headed mode (see browser)
   npm run test:e2e:headed
   
   # Debug mode (step through tests)
   npm run test:e2e:debug
   ```

## Test Structure

### Fixtures (`fixtures.ts`)
- **`supabaseAdmin`**: Admin Supabase client for test setup/teardown
- **`testUser`**: Auto-created test user for each test
- **`testTeam`**: Auto-created test team for each test
- **`authenticatedPage`**: Page with user already logged in

### Test Files
- **`auth.spec.ts`**: Authentication flows (sign in, sign up, sign out)
- **`team-management.spec.ts`**: Team operations (invite, promote, transfer ownership)

### Global Setup/Teardown
- **`global-setup.ts`**: Starts Supabase services and resets test database
- **`global-teardown.ts`**: Cleans up test data

## Configuration

### Browser Configuration
Tests run on multiple browsers by default:
- Chromium (Chrome)
- Firefox
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

### Test Data Selectors
Tests use `data-testid` attributes for reliable element selection:
```html
<!-- Example component -->
<input data-testid="email-input" type="email" />
<button data-testid="sign-in-button">Sign In</button>
```

### Environment Variables
Test environment configuration is loaded from `.env.test`:
- `SUPABASE_URL`: Local Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Admin key for test operations
- `BASE_URL`: Application URL for tests

## Best Practices

1. **Test Isolation**: Each test gets fresh test users and teams
2. **Cleanup**: Fixtures automatically clean up test data
3. **Reliable Selectors**: Use `data-testid` attributes, not CSS classes
4. **Wait Strategies**: Use `page.waitForSelector()` for dynamic content
5. **Error Handling**: Tests should handle both success and error scenarios

## Common Issues

### Supabase Not Running
```bash
# Check status
supabase status

# Start if needed
supabase start
```

### Port Conflicts
If port 3000 is busy, update `playwright.config.ts`:
```typescript
use: {
  baseURL: 'http://localhost:3001',  // Update port
}
```

### Database State Issues
```bash
# Reset database between test runs
supabase db reset --no-confirm
```

## Writing New Tests

1. **Use Fixtures**: Leverage existing fixtures for common setup
2. **Follow Patterns**: Follow existing test structure and naming
3. **Test Real Flows**: Focus on user journeys, not individual functions
4. **Handle Async**: Always await async operations properly

Example test:
```typescript
test('should complete user journey', async ({ authenticatedPage, testTeam }) => {
  // Navigate to feature
  await authenticatedPage.goto('/feature')
  
  // Interact with UI
  await authenticatedPage.click('[data-testid="action-button"]')
  
  // Verify outcome
  await expect(authenticatedPage.locator('[data-testid="success-message"]'))
    .toBeVisible()
})
```
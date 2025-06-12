# Test Database Helpers

Comprehensive testing utilities for the nuxt-supabase-team-auth module. These helpers provide factories, assertions, and utilities for creating and managing test data.

## Overview

The test helpers are organized into several modules:

- **Database**: Core database operations, seeding, and cleanup
- **User Factory**: Creating test users with different configurations
- **Team Factory**: Creating test teams with member hierarchies
- **Assertions**: Database state verification helpers
- **Invitation Helpers**: Managing invitations and role changes

## Quick Start

```typescript
import { testHelpers, TestEnvironment } from '@/tests/helpers'

// Set up clean test environment
await TestEnvironment.setup()

// Create test data
const user = await testHelpers.users.createUser()
const team = await testHelpers.teams.createTeamWithMembers({
  adminCount: 1,
  memberCount: 2
})

// Assert state
await testHelpers.assertions.assertUserExists(user.id)
await testHelpers.assertions.assertTeamMemberCount(team.team.id, 4) // owner + 1 admin + 2 members

// Clean up
await TestEnvironment.teardown()
```

## Database Utilities

### TestDatabase Class

```typescript
import { testDb } from '@/tests/helpers'

// Reset entire database
await testDb.resetDatabase()

// Clean up test data by pattern
await testDb.cleanupTestData('test-')

// Seed database with standard test data
const seedData = await testDb.seedTestData()

// Get database statistics
const stats = await testDb.getStats()
console.log(`Users: ${stats.users}, Teams: ${stats.teams}`)
```

### Seeded Data Structure

```typescript
interface SeedData {
  users: {
    owner: TestUser
    admin: TestUser
    member: TestUser
    guest: TestUser
  }
  team: TestTeam
  invites: {
    pending: TestInvite
    expired: TestInvite
  }
}
```

## User Factory

### Basic User Creation

```typescript
import { userFactory } from '@/tests/helpers'

// Create basic user
const user = await userFactory.createUser({
  emailPrefix: 'custom-test',
  password: 'CustomPassword123!',
  metadata: { custom_field: 'value' }
})

// Create user with specific role in team
const admin = await userFactory.createUserWithRole(teamId, 'admin')

// Create owner with their own team
const ownerWithTeam = await userFactory.createOwnerWithTeam({
  teamName: 'My Test Team'
})
```

### Specialized User Types

```typescript
// Super admin user
const superAdmin = await userFactory.createSuperAdmin()

// User with custom JWT claims
const userWithClaims = await userFactory.createUserWithCustomClaims({
  special_permission: true
})

// Users with different auth states
const unconfirmedUser = await userFactory.createUserWithAuthState('unconfirmed')
const bannedUser = await userFactory.createUserWithAuthState('banned')

// Batch creation for load testing
const users = await userFactory.createUserBatch(10)
```

### Complete Team Setup

```typescript
// Create team with full user hierarchy
const teamWithUsers = await userFactory.createTeamWithUsers('Complete Team')

console.log(teamWithUsers.users.owner) // Team owner
console.log(teamWithUsers.users.admin) // Team admin
console.log(teamWithUsers.users.members) // Array of team members
```

## Team Factory

### Basic Team Creation

```typescript
import { teamFactory } from '@/tests/helpers'

// Create team with custom member structure
const team = await teamFactory.createTeamWithMembers({
  name: 'Test Team',
  adminCount: 2,
  memberCount: 5
})

// Create complex team with hierarchy
const complexTeam = await teamFactory.createComplexTeam()
console.log(complexTeam.admins.senior) // Senior admin user
console.log(complexTeam.members.regular) // Array of regular members
```

### Team with Invitations

```typescript
// Create team with pending invitations
const teamWithInvites = await teamFactory.createTeamWithInvitations({
  teamName: 'Invite Test Team',
  adminCount: 1,
  memberCount: 1,
  pendingInvites: 3,
  expiredInvites: 2
})

console.log(teamWithInvites.invitations) // Array of invitation records
```

### Multi-Team Scenarios

```typescript
// Create multiple teams for testing cross-team scenarios
const teams = await teamFactory.createMultipleTeams(5, {
  adminCount: 1,
  memberCount: 3
})
```

### Team Management

```typescript
// Add member to existing team
await teamFactory.addMember(teamId, userId, 'admin')

// Remove member
await teamFactory.removeMember(teamId, userId)

// Update member role
await teamFactory.updateMemberRole(teamId, userId, 'admin')

// Get team statistics
const stats = await teamFactory.getTeamStats(teamId)
console.log(`Total: ${stats.totalMembers}, Admins: ${stats.admins}`)
```

## Database Assertions

### User Assertions

```typescript
import { dbAssertions } from '@/tests/helpers'

// Basic existence checks
await dbAssertions.assertUserExists(userId)
await dbAssertions.assertUserNotExists(userId)

// User properties
await dbAssertions.assertUserEmail(userId, 'test@example.com')
await dbAssertions.assertUserEmailConfirmed(userId)
```

### Team Assertions

```typescript
// Team existence and properties
await dbAssertions.assertTeamExists(teamId)
await dbAssertions.assertTeamName(teamId, 'Expected Name')
await dbAssertions.assertTeamCreatedBy(teamId, creatorId)
```

### Membership Assertions

```typescript
// Membership checks
await dbAssertions.assertUserIsTeamMember(userId, teamId)
await dbAssertions.assertUserTeamRole(userId, teamId, 'admin')

// Count assertions
await dbAssertions.assertTeamMemberCount(teamId, 5)
await dbAssertions.assertTeamRoleCount(teamId, 'admin', 2)
```

### Complex Assertions

```typescript
// Team structure validation
await dbAssertions.assertTeamStructure(teamId, {
  owners: 1,
  admins: 2,
  members: 5,
  total: 8
})

// User permissions validation
await dbAssertions.assertUserPermissions(userId, teamId, {
  canInvite: true,
  canPromote: false,
  canRemove: true,
  canDelete: false,
  canTransferOwnership: false
})
```

### Test-Friendly Assertions

```typescript
import { expectDatabaseState } from '@/tests/helpers'

const expect = expectDatabaseState(dbAssertions)

// Use in tests
expect.userExists(userId)
expect.teamMemberCount(teamId, 5)
expect.userHasRole(userId, teamId, 'admin')
```

## Invitation Helpers

### Creating Invitations

```typescript
import { invitationHelpers } from '@/tests/helpers'

// Create single invitation
const invitation = await invitationHelpers.createInvitation({
  teamId,
  invitedBy: ownerId,
  email: 'invite@example.com',
  role: 'member',
  expiresInHours: 48
})

// Create batch invitations
const invitations = await invitationHelpers.createBatchInvitations(
  teamId, 
  ownerId,
  [
    { email: 'user1@example.com', role: 'member' },
    { email: 'user2@example.com', role: 'admin' }
  ]
)
```

### Invitation States

```typescript
// Create invitations with different expiration states
const expirationTest = await invitationHelpers.createInvitationsWithExpirationStates(
  teamId, 
  ownerId
)

console.log(expirationTest.valid) // Valid invitation
console.log(expirationTest.expired) // Already expired
console.log(expirationTest.expiringSoon) // Expires in 1 hour
```

### Invitation Workflow

```typescript
// Accept invitation
await invitationHelpers.acceptInvitation(inviteId, acceptingUserId)

// Decline invitation
await invitationHelpers.declineInvitation(inviteId)

// Revoke invitation
await invitationHelpers.revokeInvitation(inviteId, revokingUserId)

// Simulate complete workflow
const workflow = await invitationHelpers.simulateInvitationWorkflow({
  teamId,
  invitedBy: ownerId,
  email: 'workflow@example.com',
  role: 'member',
  shouldAccept: true,
  acceptingUserId: newUserId
})

console.log(workflow.steps) // Array of workflow steps
```

### Invitation Statistics

```typescript
// Get invitation statistics
const stats = await invitationHelpers.getInvitationStats(teamId)
console.log(`Pending: ${stats.pending}, Accepted: ${stats.accepted}`)
console.log(`Admin invites: ${stats.byRole.admin}`)
```

## Role Helpers

### Role Management

```typescript
import { roleHelpers } from '@/tests/helpers'

// Change user role
const roleChange = await roleHelpers.changeUserRole(userId, teamId, 'admin')
console.log(`Changed from ${roleChange.oldRole} to ${roleChange.newRole}`)

// Test role hierarchy
const hierarchyTest = await roleHelpers.testRoleHierarchy(teamId)
if (!hierarchyTest.isValid) {
  console.log('Issues:', hierarchyTest.issues)
}
```

### Permission Testing

```typescript
// Get role permissions
const permissions = roleHelpers.getRolePermissions('admin')
console.log(`Can invite: ${permissions.canInviteMembers}`)

// Test user permissions
const canPromote = await roleHelpers.canUserPerformAction(
  userId, 
  teamId, 
  'canPromoteToAdmin'
)
```

## Test Environment Management

### Environment Setup

```typescript
import { TestEnvironment } from '@/tests/helpers'

// Complete setup for test suite
beforeAll(async () => {
  await TestEnvironment.setup()
})

// Clean up after tests
afterAll(async () => {
  await TestEnvironment.teardown()
})

// Reset between tests
beforeEach(async () => {
  await TestEnvironment.reset()
})
```

### Environment Statistics

```typescript
// Get current state
const stats = await TestEnvironment.getStats()
console.log(`Current state: ${JSON.stringify(stats, null, 2)}`)
```

## Test Data Builders

### Complete Scenarios

```typescript
import { TestDataBuilder } from '@/tests/helpers'

// Create complete test scenario
const scenario = await TestDataBuilder.createCompleteScenario()
console.log(scenario.team.owner) // Team owner
console.log(scenario.superAdmin) // Super admin user
console.log(scenario.invitations) // Pending invitations

// Multi-team scenario
const multiTeam = await TestDataBuilder.createMultiTeamScenario()
console.log(multiTeam.multiTeamUser) // User in multiple teams
```

## Best Practices

### 1. Test Isolation

Always clean up between tests:

```typescript
afterEach(async () => {
  await userFactory.cleanup()
  await teamFactory.cleanup()
})
```

### 2. Meaningful Test Data

Use descriptive prefixes for test data:

```typescript
const user = await userFactory.createUser({
  emailPrefix: 'permission-test-user'
})
```

### 3. Assertion Patterns

Use specific assertions for better error messages:

```typescript
// Good
await dbAssertions.assertTeamMemberCount(teamId, 3)

// Better with context
const assertions = createTestAssertions()
await assertions.expectTeamToHaveMembers(teamId, 3, 'after adding new member')
```

### 4. Batch Operations

Use batch operations for performance:

```typescript
// Create multiple users efficiently
const users = await userFactory.createUserBatch(10)

// Batch assertions
await dbAssertions.assertBatchUserExistence(userIds, true)
```

### 5. Error Handling

Always handle cleanup in tests:

```typescript
test('complex scenario', async () => {
  let createdUsers = []
  try {
    createdUsers = await userFactory.createUserBatch(5)
    // Test logic here
  } finally {
    // Ensure cleanup even if test fails
    await userFactory.cleanup()
  }
})
```

## Environment Variables

Required environment variables for test helpers:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Common Patterns

### Testing Team Workflows

```typescript
test('complete team workflow', async () => {
  // Setup
  const scenario = await TestDataBuilder.createCompleteScenario()
  
  // Test invitation flow
  const invitation = await invitationHelpers.createInvitation({
    teamId: scenario.team.id,
    invitedBy: scenario.team.owner.id,
    email: 'newmember@example.com',
    role: 'member'
  })
  
  await invitationHelpers.acceptInvitation(invitation.id, newUserId)
  
  // Verify state
  await dbAssertions.assertUserIsTeamMember(newUserId, scenario.team.id)
  await dbAssertions.assertUserTeamRole(newUserId, scenario.team.id, 'member')
})
```

### Testing Permission Changes

```typescript
test('role promotion workflow', async () => {
  const team = await teamFactory.createTeamWithMembers({
    memberCount: 1
  })
  
  const member = team.regularMembers[0]
  
  // Promote member to admin
  await roleHelpers.changeUserRole(member.id, team.team.id, 'admin')
  
  // Verify new permissions
  const canInvite = await roleHelpers.canUserPerformAction(
    member.id, 
    team.team.id, 
    'canInviteMembers'
  )
  expect(canInvite).toBe(true)
})
```
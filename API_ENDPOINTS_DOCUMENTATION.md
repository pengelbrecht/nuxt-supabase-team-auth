# Nuxt Supabase Team Auth - API Endpoints Documentation

This document provides comprehensive documentation for all server API endpoints in the Nuxt Supabase Team Auth module.

## Overview

The module provides 9 server API endpoints that handle team-based authentication operations. The endpoints fall into two categories:

1. **Proxy Endpoints**: Forward requests to Supabase Edge Functions (6 endpoints)
2. **Direct Server Endpoints**: Handle operations directly on the server (3 endpoints)

## Architecture Pattern

### Proxy Endpoints
Most endpoints act as proxies to Supabase Edge Functions, providing:
- Authentication header validation
- Request forwarding with proper headers
- Error handling and status code mapping
- Consistent logging

### Direct Server Endpoints
Some endpoints handle operations directly using the Supabase service role client:
- Complex authorization logic
- Database operations requiring elevated permissions
- Session management operations

## Authentication & Authorization

All endpoints (except signup) require authentication via the `Authorization` header with a Bearer token. The system uses two types of Supabase clients:

- **Anonymous Client**: For user authentication validation
- **Service Role Client**: For administrative operations requiring elevated permissions

## Endpoints Documentation

---

## 1. Accept Invite (`/api/accept-invite`)

### Purpose
Allows invited users to accept team invitations and join teams.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/accept-invite`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // Invitation token or ID (exact structure handled by edge function)
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  success: boolean
  // Additional fields returned by edge function
}
```

### Status Codes
- **200**: Invitation accepted successfully
- **401**: Missing authorization header
- **500**: Edge function error or proxy failure

### Error Handling
- Validates authorization header presence
- Forwards all errors from edge function with original status codes
- Comprehensive error logging with request/response details

### Dependencies
- Supabase Edge Function: `accept-invite`
- Runtime config for Supabase URL

---

## 2. Delete User (`/api/delete-user`)

### Purpose
Allows administrators to delete user accounts with proper authorization checks.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/delete-user`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header
- **Role Requirements**: Admin, Owner, or Super Admin in shared team

### Request Parameters
```typescript
interface DeleteUserRequest {
  userId: string // UUID of user to delete
}
```

### Response Format
```typescript
// Success response
{
  success: true
}
```

### Status Codes
- **200**: User deleted successfully
- **400**: Missing userId or target user not found
- **401**: Authentication required
- **403**: Insufficient permissions
- **500**: Database operation failed

### Authorization Logic
1. **Current User Validation**: Must be authenticated
2. **Permission Check**: Must be admin/owner/super_admin in at least one team
3. **Shared Team Validation**: Can only delete users from shared teams
4. **Owner Protection**: Only super_admins can delete team owners
5. **Self-Protection**: Cannot delete yourself (implicit)

### Error Handling
- Comprehensive permission validation
- Database transaction safety
- Cascading delete (profiles and team_members automatically removed)

### Dependencies
- Supabase Service Role Client
- Database tables: `team_members`, `profiles`, `auth.users`

---

## 3. Get Pending Invitations (`/api/get-pending-invitations`)

### Purpose
Retrieves pending team invitations for the authenticated user.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/get-pending-invitations`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // Request parameters handled by edge function
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  invitations: Array<{
    // Invitation objects structure defined by edge function
  }>
}
```

### Status Codes
- **200**: Invitations retrieved successfully
- **401**: Missing authorization header
- **500**: Edge function error or proxy failure

### Error Handling
- Basic proxy error handling
- Authorization header validation
- Error forwarding from edge function

### Dependencies
- Supabase Edge Function: `get-pending-invitations`

---

## 4. Impersonate User (`/api/impersonate`)

### Purpose
Allows super administrators to impersonate other users for support and debugging purposes.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/impersonate`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header
- **Role Requirements**: Super Admin only

### Request Parameters
```typescript
{
  targetUserId: string // UUID of user to impersonate
  reason: string       // Reason for impersonation (min 10 characters)
}
```

### Response Format
```typescript
// Success response
{
  success: true
  impersonation: {
    session_id: string
    target_user: {
      id: string
      email: string
      full_name: string
      role: string
      team: {
        id: string
        name: string
      }
    }
    expires_at: string // ISO timestamp
  }
  session: SupabaseSession    // New session for impersonated user
  originalUser: {
    id: string
    email: string
  }
}
```

### Status Codes
- **200**: Impersonation started successfully
- **400**: Missing/invalid parameters
- **401**: Authentication required
- **403**: Not a super admin or trying to impersonate another super admin
- **404**: Target user not found
- **500**: Session creation failed

### Security Features
1. **Super Admin Only**: Strict role validation
2. **Audit Logging**: Records impersonation sessions in database
3. **Time Limits**: 30-minute session expiration
4. **Reason Required**: Mandatory justification (min 10 chars)
5. **Protection**: Cannot impersonate other super admins
6. **Secure Storage**: JWT token stored in httpOnly cookie

### Session Management
- Creates impersonation session record in database
- Generates magic link for target user
- Immediately verifies OTP to create session
- Stores admin credentials in signed JWT cookie

### Dependencies
- Supabase Service Role Client
- JWT library for secure token creation
- Database tables: `impersonation_sessions`, `team_members`, `profiles`

---

## 5. Invite Member (`/api/invite-member`)

### Purpose
Allows team administrators to invite new members to their teams.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/invite-member`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // Invitation details handled by edge function
  // Typically includes: email, role, team_id
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  success: boolean
  // Additional invitation details from edge function
}
```

### Status Codes
- **200**: Invitation sent successfully
- **401**: Missing authorization header
- **500**: Edge function error or proxy failure

### Error Handling
- Extensive logging for debugging
- Authorization header validation
- Error forwarding with original status codes

### Dependencies
- Supabase Edge Function: `invite-member`

---

## 6. Revoke Invitation (`/api/revoke-invitation`)

### Purpose
Allows team administrators to revoke pending invitations.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/revoke-invitation`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // Invitation ID or identifier handled by edge function
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  success: boolean
  // Additional response data from edge function
}
```

### Status Codes
- **200**: Invitation revoked successfully
- **401**: Missing authorization header
- **500**: Edge function error or proxy failure

### Dependencies
- Supabase Edge Function: `revoke-invitation`

---

## 7. Signup with Team (`/api/signup-with-team`)

### Purpose
Handles new user registration with automatic team creation.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/signup-with-team`

### Authentication Requirements
- **Required**: No (public endpoint for registration)

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // User registration and team creation data
  // Typically includes: email, password, team_name, user details
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  success: boolean
  // User and team creation details from edge function
}
```

### Status Codes
- **200**: Signup completed successfully
- **500**: Edge function error or registration failure

### Special Characteristics
- **No Authentication Required**: Public endpoint for new user registration
- **Team Creation**: Simultaneously creates user account and team
- **Owner Role**: New user becomes team owner automatically

### Dependencies
- Supabase Edge Function: `signup-with-team`

---

## 8. Stop Impersonation (`/api/stop-impersonation`)

### Purpose
Ends an active impersonation session and restores the original admin session.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/stop-impersonation`

### Authentication Requirements
- **Required**: Yes (as impersonated user)
- **Additional**: Admin impersonation JWT cookie

### Request Parameters
```typescript
{
  sessionId: string // ID of impersonation session to end
}
```

### Response Format
```typescript
// Success response
{
  success: true
  message: "Impersonation ended successfully"
  session: SupabaseSession // Restored admin session
}
```

### Status Codes
- **200**: Impersonation ended, admin session restored
- **400**: Missing session ID or invalid JWT cookie
- **401**: Not authenticated
- **404**: Active impersonation session not found
- **500**: Session restoration failed

### Security Features
1. **Session Validation**: Verifies active impersonation session exists
2. **JWT Verification**: Validates admin impersonation cookie
3. **Automatic Cleanup**: Removes impersonation cookie
4. **Session Restoration**: Creates new admin session via magic link
5. **Audit Trail**: Marks session as ended in database

### Session Restoration Process
1. Validates impersonation session and JWT cookie
2. Extracts admin email from JWT
3. Marks impersonation session as ended
4. Generates magic link for admin user
5. Immediately verifies OTP to create admin session
6. Cleans up impersonation cookie

### Dependencies
- Supabase Service Role Client
- JWT library for token verification
- Database table: `impersonation_sessions`

---

## 9. Transfer Ownership (`/api/transfer-ownership`)

### Purpose
Allows team owners to transfer ownership to another team member.

### HTTP Method & Route
- **Method**: POST
- **Route**: `/api/transfer-ownership`

### Authentication Requirements
- **Required**: Yes
- **Type**: Bearer token in Authorization header

### Request Parameters
```typescript
// Body structure (proxied to edge function)
{
  // Transfer details handled by edge function
  // Typically includes: new_owner_id, team_id
}
```

### Response Format
```typescript
// Success response (from edge function)
{
  success: boolean
  // Transfer confirmation details from edge function
}
```

### Status Codes
- **200**: Ownership transferred successfully
- **401**: Missing authorization header
- **500**: Edge function error or transfer failure

### Dependencies
- Supabase Edge Function: `transfer-ownership`

---

## Utility Functions

### `createServiceRoleClient()`
Creates a Supabase client with service role permissions for administrative operations.

**Features:**
- Uses service role key for elevated permissions
- Disables auto-refresh and session persistence for server use
- Validates required configuration

### `getCurrentUser(event)`
Extracts and validates the current user from the request authorization header.

**Process:**
1. Extracts Bearer token from Authorization header
2. Creates anonymous Supabase client
3. Validates token and returns user object
4. Returns null for invalid/missing tokens

### `createSupabaseClientFromEvent(event)`
Creates a Supabase client configured with the request's authorization context.

**Features:**
- Uses anonymous key with user's auth token
- Automatically includes Authorization header in requests
- Server-optimized configuration

---

## Common Error Patterns

### Authentication Errors
```typescript
{
  statusCode: 401,
  statusMessage: "Missing authorization header" | "Authentication required"
}
```

### Authorization Errors
```typescript
{
  statusCode: 403,
  statusMessage: "Access denied" | "Insufficient permissions"
}
```

### Validation Errors
```typescript
{
  statusCode: 400,
  statusMessage: "Missing required parameter" | "Invalid input"
}
```

### Server Errors
```typescript
{
  statusCode: 500,
  statusMessage: "Internal server error" | "Database operation failed"
}
```

---

## Security Considerations

### Input Validation
- All endpoints validate required parameters
- Authorization headers are strictly validated
- Role-based access control is enforced

### Data Protection
- Service role operations are limited to necessary functions
- User data access is restricted by team membership
- Sensitive operations require elevated permissions

### Audit Trail
- Impersonation sessions are logged with reasons
- Administrative actions are traceable
- Error logging provides debugging information without exposing sensitive data

### Session Security
- JWT tokens are signed and time-limited
- HttpOnly cookies prevent client-side access
- Magic links are immediately consumed after generation

---

## Configuration Requirements

### Environment Variables
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

### Runtime Configuration
The endpoints use Nuxt's `useRuntimeConfig()` to access:
- `supabaseUrl` - Supabase project URL
- `supabaseAnonKey` - Public anonymous key
- `supabaseServiceKey` - Service role key (server-only)

---

## Edge Function Dependencies

The following endpoints require corresponding Supabase Edge Functions to be deployed:

1. `accept-invite` - Handles invitation acceptance logic
2. `get-pending-invitations` - Retrieves user's pending invitations
3. `invite-member` - Creates and sends team invitations
4. `revoke-invitation` - Cancels pending invitations
5. `signup-with-team` - Handles user registration with team creation
6. `transfer-ownership` - Manages team ownership transfers

These edge functions contain the core business logic, while the Nuxt endpoints serve as authenticated proxies.
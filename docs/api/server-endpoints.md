# Server API Endpoints

The Nuxt Supabase Team Auth module automatically provides server API endpoints for team authentication operations. These endpoints are available in your Nuxt application without any additional setup.

## Authentication Endpoints

### POST `/api/signup-with-team`

Creates a new user account and team in a single operation.

**Request Body:**
```typescript
{
  email: string
  password: string
  teamName: string
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  user?: User
  team?: Team
}
```

**Usage:**
```typescript
const response = await $fetch('/api/signup-with-team', {
  method: 'POST',
  body: {
    email: 'user@example.com',
    password: 'securepassword',
    teamName: 'My Team'
  }
})
```

## Team Management Endpoints

### POST `/api/invite-member`

Invites a new member to join a team.

**Authorization:** Requires `Owner` or `Admin` role

**Request Headers:**
```typescript
{
  'Authorization': 'Bearer <access_token>'
}
```

**Request Body:**
```typescript
{
  email: string
  role: 'member' | 'admin'
  teamId: string
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  invitationId?: string
}
```

### POST `/api/accept-invite`

Accepts a team invitation.

**Request Body:**
```typescript
{
  team_id: string
  email: string
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  team?: Team
}
```

### POST `/api/revoke-invitation`

Revokes a pending team invitation.

**Authorization:** Requires `Owner` or `Admin` role

**Request Body:**
```typescript
{
  invitationId: string
  teamId: string
}
```

### POST `/api/get-pending-invitations`

Retrieves pending invitations for a team.

**Authorization:** Requires `Owner` or `Admin` role

**Request Body:**
```typescript
{
  teamId: string
}
```

**Response:**
```typescript
{
  success: boolean
  invitations: Array<{
    id: string
    email: string
    role: string
    created_at: string
  }>
}
```

### POST `/api/transfer-ownership`

Transfers team ownership to another member.

**Authorization:** Requires `Owner` role

**Request Body:**
```typescript
{
  teamId: string
  newOwnerId: string
}
```

## User Management Endpoints

### POST `/api/delete-user`

Deletes a user account and removes them from all teams.

**Authorization:** Requires `Owner` role or user deleting their own account

**Request Body:**
```typescript
{
  userId: string
  teamId?: string // Required when deleting other users
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
}
```

## Impersonation Endpoints

### POST `/api/impersonate`

Starts user impersonation (Super Admin only).

**Authorization:** Requires `Super Admin` role

**Request Headers:**
```typescript
{
  'Authorization': 'Bearer <access_token>'
}
```

**Request Body:**
```typescript
{
  targetUserId: string
  reason: string
}
```

**Response:**
```typescript
{
  success: boolean
  session: {
    access_token: string
    refresh_token: string
  }
  impersonation: {
    target_user: User
    session_id: string
    expires_at: string
  }
}
```

**Features:**
- Creates audit log entry with reason
- Time-limited sessions (30 minutes default)
- Secure token exchange
- Original session preservation

### POST `/api/stop-impersonation`

Stops an active impersonation session.

**Request Headers:**
```typescript
{
  'Authorization': 'Bearer <impersonation_token>'
}
```

**Request Body:**
```typescript
{
  sessionId: string
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
}
```

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  success: false
  message: string
  error?: {
    code: string
    details?: any
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Invalid request parameters
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `RATE_LIMITED` - Too many requests

## Security Considerations

### Authentication
- All protected endpoints require valid JWT tokens
- Tokens are verified against Supabase auth
- Role-based access control is enforced

### Rate Limiting
- Built-in Supabase rate limiting
- Consider additional rate limiting for public endpoints

### Input Validation
- All request parameters are validated
- SQL injection protection via Supabase client
- XSS prevention on user-generated content

### Audit Logging
- Impersonation sessions are fully audited
- User deletions are logged
- Team ownership transfers are tracked

## Integration with Edge Functions

Some endpoints proxy requests to Supabase Edge Functions for enhanced security:

- `/api/signup-with-team` → `create-team-and-owner`
- `/api/invite-member` → `invite-member`
- `/api/accept-invite` → `accept-invite`
- `/api/revoke-invitation` → `revoke-invitation`
- `/api/transfer-ownership` → `transfer-ownership`

This architecture provides:
- Server-side validation
- Secure database operations
- Consistent error handling
- Better performance through edge computing

## Development and Testing

### Local Development
```bash
# Start the development server
pnpm run dev

# Test endpoints with curl
curl -X POST http://localhost:3000/api/signup-with-team \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","teamName":"Test Team"}'
```

### Environment Variables
```bash
# Required for server endpoints
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key # For server operations
```

### Testing with Postman/Insomnia
Import the provided collection file: `docs/api/postman-collection.json`
# Impersonation Implementation Scratchpad

## Overview
This document tracks the implementation journey of the secure impersonation feature, documenting what has worked, what has failed, and the current status.

## Initial Problem
- Started with improving UI (RoleBadge spacing and button styling) ✅
- Discovered critical security vulnerability: access tokens were exposed in localStorage where they could be accessed via XSS attacks
- Core requirement: Remove all tokens from localStorage while maintaining seamless session switching

## Approaches Attempted

### 1. Initial Approach - Store Tokens in Database (Partial Success)
**What we tried:**
- Added `original_access_token` and `original_refresh_token` columns to `impersonation_sessions` table
- Attempted to store both tokens during impersonation start

**What worked:**
- Successfully stored access token from Authorization header
- Database schema migration worked correctly

**What failed:**
- Could not obtain refresh token server-side (it's not included in API requests)
- Had to remove `original_refresh_token` column in subsequent migration

### 2. Current Approach - Hybrid Storage (In Progress)
**What we're trying:**
- Store access token in database (working)
- Store refresh token in httpOnly cookie (partially working)
- Cookie named `impersonation-${sessionLog.id}` for security isolation

**Current implementation:**
```typescript
// During impersonation start:
// 1. Extract access token from Authorization header ✅
// 2. Store in database ✅
// 3. Try to get refresh token from Supabase cookie ⚠️
// 4. Store refresh token in secure httpOnly cookie ⚠️

// During impersonation stop:
// 1. Retrieve access token from database ✅
// 2. Retrieve refresh token from httpOnly cookie ❌
// 3. Restore original session using both tokens
```

## Cookie Challenges

### Discovery: Supabase Cookie Naming
- Supabase uses project-specific cookie names: `sb-<project-ref>-auth-token`
- For local development: Could be `sb-localhost-auth-token` or `sb-127.0.0.1:54321-auth-token`
- Cookie contains JSON with both access and refresh tokens

### Current Cookie Implementation
```typescript
// We're checking multiple possible cookie names:
const possibleCookieNames = [
  'sb-localhost-auth-token',
  'sb-127.0.0.1:54321-auth-token', 
  'sb-refresh-token',
  'supabase-auth-token',
  'supabase.auth.token'
]
```

### Issues Encountered
1. **Cookie not found during stop impersonation**
   - Error: "Original refresh token not found in secure storage"
   - Possible causes:
     - Cookie domain/path mismatch
     - Secure cookie flag in development
     - Cookie not being properly set or retrieved

2. **Development vs Production**
   - Changed `secure: true` to `secure: process.env.NODE_ENV === 'production'`
   - Added debugging to log available cookies

## What's Working ✅
1. **UI Improvements**
   - RoleBadge spacing fixed with wrapper div
   - Button styling updated to solid neutral

2. **Security Improvements**  
   - Access tokens no longer stored in localStorage
   - Tokens stored server-side only
   - Impersonation flow creates proper session

3. **Database Storage**
   - Access token successfully stored in `impersonation_sessions` table
   - Token retrieved correctly during stop impersonation

4. **Basic Impersonation Flow**
   - Starting impersonation works
   - New session created for target user
   - Session includes impersonation metadata

## What's Not Working ❌
1. **Session Restoration**
   - Cannot seamlessly restore admin session
   - Refresh token not being found in cookie storage
   - User explicitly rejected signing out as a solution

2. **Cookie Handling**
   - httpOnly cookie not being properly set or retrieved
   - Unclear which Supabase cookie name to use in development

## Alternative Approaches Considered

### 1. Temporary Session Storage (Rejected)
- User rejected "temporary solution" comments
- Must be production-ready

### 2. Sign Out Approach (Rejected)
- User explicitly said: "stop. that's not a solution"
- Must achieve seamless session switching

### 3. Store Refresh Token in localStorage (Rejected)
- User asked if this was possible
- Correctly answered: No, refresh tokens are sensitive and vulnerable to XSS

## Next Steps

### Immediate Debugging Needs
1. Run impersonation flow and check server logs for:
   - What cookies are actually available
   - Whether Supabase auth cookie is accessible
   - If refresh token can be extracted

2. Verify cookie settings:
   - Check domain/path configuration
   - Ensure cookies work in development environment
   - Test cookie persistence across requests

### Potential Solutions
1. **Use Supabase's Built-in Session Management**
   - Investigate if Supabase has APIs for session preservation
   - Look for official impersonation support

2. **Server-Side Session Cache**
   - Store entire session object server-side temporarily
   - Use Redis or in-memory cache for development

3. **Custom Auth Flow**
   - Create custom authentication flow that doesn't rely on cookies
   - Use secure server-side session management

## Current Status
- Impersonation can be started ✅
- Access token is stored securely ✅
- Session restoration is blocked on refresh token retrieval ❌
- Debugging logs have been added to understand cookie behavior
- Awaiting test results to determine next approach

## Key Learnings
1. Supabase stores tokens in httpOnly cookies with project-specific names
2. Refresh tokens cannot be obtained from Authorization headers
3. Server-side cookie handling in Nuxt/H3 requires careful configuration
4. Development environment may have different cookie behavior than production
5. Security must be maintained while ensuring seamless UX
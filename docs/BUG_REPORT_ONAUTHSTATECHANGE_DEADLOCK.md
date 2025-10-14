# Bug Report: Navigator Lock Deadlock in onAuthStateChange Callback

**Module**: `nuxt-supabase-team-auth` v0.6.12
**Severity**: Critical - Production Breaking
**Status**: Confirmed Root Cause
**Date**: 2025-10-14

---

## Summary

The `useTeamAuth` composable makes async Supabase database queries inside the `onAuthStateChange` callback, which violates Supabase's documented best practices and causes Navigator Lock deadlocks that permanently break authentication for users.

---

## Symptoms

1. **Production users experience permanent auth failure**:
   - `getSession()` times out after 5000ms
   - Console shows: "Missing authorization header" on API calls
   - Page refreshes don't fix the issue
   - Clearing cookies/cache doesn't fix the issue
   - Only solution is closing ALL browser tabs and restarting browser

2. **Inconsistent occurrence**:
   - Works fine for days/weeks in the same browser
   - Suddenly breaks and stays broken
   - Fresh browser/incognito mode works fine initially

3. **Technical indicators**:
   - Navigator Locks API shows 1 held lock blocking 2-3 pending locks
   - Lock name: `lock:sb-{project-ref}-auth-token`
   - Locks persist even after closing tabs (abnormal behavior)
   - No Supabase network requests during `getSession()` timeout

---

## Root Cause

**File**: `src/runtime/composables/useTeamAuth.ts`
**Lines**: 455-474

```typescript
// Setup auth listener once globally
if (!authListenerRegistered) {
  authListenerRegistered = true

  getClient().auth.onAuthStateChange(async (event, session) => {
    console.log('[useTeamAuth] Auth state change event:', event, 'Session exists:', !!session)

    // Deduplicate events
    const eventKey = `${event}:${session?.user?.id || 'none'}:${session?.user?.email || 'none'}`
    if (lastProcessedEvent.value === eventKey) {
      console.log('[useTeamAuth] Skipping duplicate event:', eventKey)
      return
    }
    lastProcessedEvent.value = eventKey
    console.log('[useTeamAuth] Processing auth event:', event)

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        if (session?.user) {
          console.log('[useTeamAuth] Updating auth state for user:', session.user.email)
          await updateCompleteAuthState(session.user)  // ← PROBLEM: Async Supabase calls
        }
        break

      case 'SIGNED_OUT':
        console.log('[useTeamAuth] Processing SIGNED_OUT event, resetting auth state...')
        resetAuthState()
        lastProcessedEvent.value = '' // Reset on signout
        console.log('[useTeamAuth] Auth state reset complete')
        break
    }
  })
}
```

**The problem**: `updateCompleteAuthState()` makes async database queries **while still inside the `onAuthStateChange` callback**.

**Lines 319-339** (inside `updateCompleteAuthState()`):
```typescript
const [profileResult, teamResult] = await Promise.all([
  getClient()
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single(),

  getClient()
    .from('team_members')
    .select(`
      role,
      teams!inner (...)
    `)
    .eq('user_id', user.id)
    .single(),
])
```

These database queries internally call `getSession()` for authorization headers, which tries to acquire the same Navigator Lock that's already held by the `onAuthStateChange` callback, causing a **deadlock**.

---

## Official Supabase Documentation

**Source**: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

### Official Warning:

> **Important:** A callback can be an `async` function and it runs synchronously during the processing of the changes causing the event. You can easily create a dead-lock by using `await` on a call to another method of the Supabase library.
>
> - Avoid using `async` functions as callbacks.
> - Limit the number of `await` calls in `async` callbacks.
> - **Do not use other Supabase functions in the callback function.** If you must, dispatch the functions once the callback has finished executing.

### Recommended Solution:

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    // await on other Supabase function here
    // this runs right after the callback has finished
  }, 0)
})
```

---

## Related Issues

1. **Supabase GitHub Issue #762**: "Supabase operations in onAuthStateChange will cause the next call to supabase anywhere else in the code to not return"
   - URL: https://github.com/supabase/gotrue-js/issues/762
   - User quote: "hitting the database when receiving TOKEN_REFRESHED callbacks broke something such that subsequent getSession() calls would all hang"

2. **Community blog post**: "Lovable + Supabase how to fix: Application hangs up after user logs in"
   - URL: https://tomaspozo.com/articles/series-lovable-supabase-errors-application-hangs-up-after-log-in
   - Describes the same deadlock pattern

---

## Proposed Fix

Wrap async Supabase operations in `setTimeout()` to defer them until after the callback completes:

```typescript
getClient().auth.onAuthStateChange((event, session) => {  // ← Remove async
  console.log('[useTeamAuth] Auth state change event:', event, 'Session exists:', !!session)

  // Deduplicate events
  const eventKey = `${event}:${session?.user?.id || 'none'}:${session?.user?.email || 'none'}`
  if (lastProcessedEvent.value === eventKey) {
    console.log('[useTeamAuth] Skipping duplicate event:', eventKey)
    return
  }
  lastProcessedEvent.value = eventKey
  console.log('[useTeamAuth] Processing auth event:', event)

  // Defer async operations using setTimeout
  setTimeout(async () => {  // ← Move async here
    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        if (session?.user) {
          console.log('[useTeamAuth] Updating auth state for user:', session.user.email)
          await updateCompleteAuthState(session.user)
        }
        break

      case 'SIGNED_OUT':
        console.log('[useTeamAuth] Processing SIGNED_OUT event, resetting auth state...')
        resetAuthState()
        lastProcessedEvent.value = '' // Reset on signout
        console.log('[useTeamAuth] Auth state reset complete')
        break
    }
  }, 0)  // ← Defer to next tick
})
```

---

## Testing Verification

After implementing the fix, verify:

1. **No Navigator Lock deadlocks**:
   ```javascript
   // In browser console
   navigator.locks.query().then(state => {
     console.log('Held locks:', state.held.length)
     console.log('Pending locks:', state.pending.length)
   })
   ```
   Should show: `Held locks: 0`, `Pending locks: 0` when idle

2. **getSession completes quickly**:
   ```javascript
   const start = Date.now()
   await supabase.auth.getSession()
   console.log('Duration:', Date.now() - start, 'ms')
   ```
   Should complete in <100ms

3. **Auth state updates correctly** on SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED events

4. **No "Missing authorization header" errors** on API calls after auth events

---

## Environment Details

- **Module version**: `nuxt-supabase-team-auth@0.6.12`
- **Supabase JS version**: `@supabase/supabase-js@2.58.0`
- **Auth JS version**: `@supabase/auth-js@2.72.0`
- **Framework**: Nuxt 3.18.0
- **Deployment**: Cloudflare Workers via NuxtHub

---

## Additional Context

The module's `getSessionWithReset()` wrapper correctly implements a 5000ms timeout to detect and recover from deadlocks, which is why the symptom presents as a timeout rather than an infinite hang. However, the recovery mechanism (resetting the client) doesn't work because the Navigator Lock persists at the browser level.

The timeout wrapper is a good defensive measure, but it doesn't address the root cause. The proper fix is to avoid creating the deadlock in the first place by following Supabase's documented best practices.

---

## Impact Assessment

- **Severity**: Critical
- **User Impact**: Complete authentication failure requiring browser restart
- **Occurrence**: Intermittent but permanent once triggered
- **Affected Users**: Production users on Cloudflare Workers deployment
- **Workarounds**: None available to end users

---

## References

1. Official Supabase docs: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
2. GitHub issue #762: https://github.com/supabase/gotrue-js/issues/762
3. Navigator Locks API spec: https://w3c.github.io/web-locks/
4. Community fix guide: https://tomaspozo.com/articles/series-lovable-supabase-errors-application-hangs-up-after-log-in

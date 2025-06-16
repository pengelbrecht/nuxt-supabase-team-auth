# Claude Development Notes

## Package Manager
- **Always use `pnpm`** - NOT npm or yarn
- Commands: `pnpm install`, `pnpm run dev`, `pnpm run build`, etc.

## Database Architecture (Established - Don't Change)
- **`public.profiles`** table stores user profile data (full_name, avatar_url, etc.)
- **`public.team_members`** table handles team memberships and roles only
- **No JWT claims** - always fetch team data from database via team_members join
- User profile data is stored in `public.profiles.id` which equals `auth.uid()`

## Authentication Flow (Working)
- Sign up creates user + team via Edge Function, then signs in with password
- Sign in fetches team membership from database (not JWT claims)
- Profile updates go to `public.profiles` table
- Password changes go through Supabase auth system

## Components (Fixed - Don't Modify)
- **UserButton**: Shows user icon when signed out, user initials when signed in
- **ProfileForm**: Separated password changes from profile updates for better UX
- **AuthSignUpWithTeam**: Working with comprehensive error handling

## Key Lessons Learned
1. **Component loading states** - Use local loading state (`isProfileLoading`) NOT global auth loading state (`isLoading`)
2. **Watchers and background processes** - Watch specific properties (like user ID) not entire objects to avoid unnecessary triggers
3. **Form submission** - Use direct @click handlers instead of UForm @submit for complex forms
4. **Profile reloading** - Don't reload profile data after save, just update local form state

## Testing Commands
- `supabase status` - check if services running
- `supabase db reset` - reset database and apply migrations
- `pnpm run dev` - start dev server

## Database Schema (Stable)
```sql
-- profiles table stores user data
public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  avatar_url text,
  ...
)

-- team_members handles roles and memberships
public.team_members (
  team_id uuid REFERENCES teams(id),
  user_id uuid REFERENCES auth.users(id),
  role text -- 'owner', 'admin', 'member', 'super_admin'
)
```

## Don't Re-implement
-  JWT claims parsing (we don't use custom claims)
-  Profiles table structure 
-  UserButton avatar fallback logic
-  ProfileForm UX improvements
-  RLS policies (keep them simple - users access own data only)
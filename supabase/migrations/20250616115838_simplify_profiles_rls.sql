-- Completely simplify profiles RLS to avoid any recursion
-- Remove all team-based policies for now, keep only basic user policies

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Team members can view shared team profiles" ON public.profiles;

-- Create simple, non-recursive policies
-- Users can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "profiles_delete_own" ON public.profiles
    FOR DELETE USING (auth.uid() = id);
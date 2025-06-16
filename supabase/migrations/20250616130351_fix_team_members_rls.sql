-- Fix team_members RLS policies to avoid circular references
-- The issue is that the SELECT policy references team_members from within team_members

-- Drop existing problematic policies
DROP POLICY IF EXISTS "team_members_can_select_same_team" ON public.team_members;
DROP POLICY IF EXISTS "admins_owners_can_insert_members" ON public.team_members;
DROP POLICY IF EXISTS "admins_owners_can_update_members" ON public.team_members;
DROP POLICY IF EXISTS "admins_owners_can_delete_members" ON public.team_members;
DROP POLICY IF EXISTS "super_admins_full_access_team_members" ON public.team_members;

-- Create simple, non-circular policies for team_members

-- Users can view their own team memberships
CREATE POLICY "team_members_select_own" ON public.team_members
    FOR SELECT USING (user_id = auth.uid());

-- For now, only allow service role to insert team members (used by Edge Functions)
-- This prevents users from adding themselves to teams directly
CREATE POLICY "service_role_can_insert_team_members" ON public.team_members
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users cannot update or delete team memberships directly
-- (This should be done through Edge Functions with proper permission checks)

-- Super admins can do anything (if they exist)
CREATE POLICY "super_admins_full_access_team_members" ON public.team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm 
            WHERE tm.user_id = auth.uid() 
            AND tm.role = 'super_admin'
        )
    );
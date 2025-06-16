-- Fix infinite recursion in profiles RLS policies
-- Drop the problematic team members policy and simplify

-- Drop the existing team members policy that causes recursion
DROP POLICY IF EXISTS "Team members can view other members profiles" ON public.profiles;

-- Keep the simple policies that work without recursion
-- Users can always view, insert, update, and delete their own profile
-- These policies are already in place and working correctly

-- Add a simpler policy for team member profile viewing that doesn't cause recursion
-- This policy allows users to view profiles of users who are in the same teams,
-- but uses a more direct approach to avoid infinite recursion
CREATE POLICY "Team members can view shared team profiles" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 
            FROM public.team_members tm_viewer
            WHERE tm_viewer.user_id = auth.uid()
            AND tm_viewer.team_id IN (
                SELECT tm_target.team_id 
                FROM public.team_members tm_target 
                WHERE tm_target.user_id = profiles.id
            )
        )
    );
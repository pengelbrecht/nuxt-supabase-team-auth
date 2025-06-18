-- Fix profile visibility by replacing overly restrictive policies
-- Multiple SELECT policies are combined with AND logic, so we need to consolidate them

-- Drop the overly restrictive policy that only allows users to see their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

-- Our team_members_can_view_team_profiles policy already includes "OR id = auth.uid()" 
-- so users can still see their own profile plus team members' profiles

-- Let's also check if we have a similar issue with teams
-- We should allow team members to see their team's details
DROP POLICY IF EXISTS "team_members_can_select_own_team" ON teams;

-- Create a new consolidated team visibility policy  
CREATE POLICY "team_members_can_view_their_teams" ON teams
  FOR SELECT
  USING (id = ANY(get_user_team_ids()));
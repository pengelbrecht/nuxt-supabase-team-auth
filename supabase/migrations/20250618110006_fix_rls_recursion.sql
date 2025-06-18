-- Fix infinite recursion in RLS policies by using security definer functions
-- This allows internal queries to bypass RLS while maintaining security

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "team_members_can_select_same_team" ON team_members;
DROP POLICY IF EXISTS "team_members_can_view_team_profiles" ON profiles;

-- Create a security definer function to get user's team IDs without triggering RLS
CREATE OR REPLACE FUNCTION get_user_team_ids(user_uuid uuid DEFAULT auth.uid())
RETURNS uuid[] 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT team_id 
    FROM team_members 
    WHERE user_id = user_uuid
  );
$$;

-- Create a security definer function to get team member user IDs for a specific team
CREATE OR REPLACE FUNCTION get_team_member_ids(team_uuid uuid)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER  
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT user_id 
    FROM team_members 
    WHERE team_id = team_uuid
  );
$$;

-- Recreate team_members policy using the security definer function
CREATE POLICY "team_members_can_select_same_team" ON team_members
  FOR SELECT
  USING (team_id = ANY(get_user_team_ids()));

-- Recreate profiles policy for team member visibility using security definer function  
CREATE POLICY "team_members_can_view_team_profiles" ON profiles
  FOR SELECT 
  USING (
    id = auth.uid() OR  -- Users can always see their own profile
    id = ANY(
      SELECT unnest(get_team_member_ids(team_id))
      FROM unnest(get_user_team_ids()) AS team_id
    )
  );

COMMENT ON FUNCTION get_user_team_ids(uuid) IS 'Get team IDs for a user without triggering RLS recursion';
COMMENT ON FUNCTION get_team_member_ids(uuid) IS 'Get member user IDs for a team without triggering RLS recursion';
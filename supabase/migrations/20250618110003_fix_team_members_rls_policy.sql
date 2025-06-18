-- Fix team_members RLS policy to allow team members to see other members of the same team
-- Currently users can only see their own membership, not other team members

-- Drop the restrictive policy
DROP POLICY IF EXISTS "team_members_select_own" ON team_members;

-- Create a new policy that allows team members to see all members of teams they belong to
CREATE POLICY "team_members_can_select_same_team" ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );
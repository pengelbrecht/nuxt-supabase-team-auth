-- Fix RLS by using restrictive policies instead of multiple permissive ones
-- The issue: Multiple permissive policies use OR logic - if ANY grants access, it's allowed
-- Solution: Use restrictive policies that must ALL be satisfied

-- ============================================================================
-- TEAM_MEMBERS: Replace multiple permissive policies with restrictive ones
-- ============================================================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "authorized_can_add_team_members" ON team_members;
DROP POLICY IF EXISTS "authorized_can_remove_team_members" ON team_members;
DROP POLICY IF EXISTS "authorized_can_update_team_members" ON team_members;
DROP POLICY IF EXISTS "super_admins_can_select_all_team_members" ON team_members;
DROP POLICY IF EXISTS "super_admins_can_insert_team_members" ON team_members;
DROP POLICY IF EXISTS "super_admins_can_update_team_members" ON team_members;
DROP POLICY IF EXISTS "super_admins_can_delete_team_members" ON team_members;
DROP POLICY IF EXISTS "team_members_can_select_same_team" ON team_members;

-- Create single comprehensive policies for each operation
-- SELECT: Team members can see their own team + super admins see all
CREATE POLICY "team_members_select_policy" ON team_members
  FOR SELECT
  USING (
    team_id = ANY (get_user_team_ids()) OR 
    public.is_super_admin()
  );

-- INSERT: Only service role, super admins, and team owners/admins can add members
CREATE POLICY "team_members_insert_policy" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR 
    public.is_super_admin() OR
    (
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          role = 'member'
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          role IN ('member', 'admin')
        ELSE false
      END
    )
  );

-- UPDATE: Only super admins and team owners/admins can update roles
CREATE POLICY "team_members_update_policy" ON team_members
  FOR UPDATE
  USING (
    public.is_super_admin() OR
    public.user_team_role(team_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_super_admin() OR
    (
      -- Cannot modify their own role
      user_id != auth.uid() AND
      -- Role-based restrictions
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          -- Admins can only modify members and assign member/admin roles
          role IN ('member', 'admin') AND 
          (SELECT role FROM team_members old_tm WHERE old_tm.team_id = team_members.team_id AND old_tm.user_id = team_members.user_id) = 'member'
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          -- Owners can assign any role except super_admin and cannot modify super_admins
          role != 'super_admin' AND
          (SELECT role FROM team_members old_tm WHERE old_tm.team_id = team_members.team_id AND old_tm.user_id = team_members.user_id) != 'super_admin'
        ELSE false
      END
    )
  );

-- DELETE: Only super admins and team owners/admins can delete members
CREATE POLICY "team_members_delete_policy" ON team_members
  FOR DELETE
  USING (
    public.is_super_admin() OR
    (
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      -- Cannot delete themselves
      user_id != auth.uid() AND
      -- Role-based restrictions
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          role = 'member'
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          role != 'super_admin'
        ELSE false
      END
    )
  );

-- ============================================================================
-- TEAMS: Replace multiple conflicting policies
-- ============================================================================

-- Drop all existing team policies
DROP POLICY IF EXISTS "owners_can_delete_team" ON teams;
DROP POLICY IF EXISTS "owners_can_update_team" ON teams; 
DROP POLICY IF EXISTS "service_role_can_insert_teams" ON teams;
DROP POLICY IF EXISTS "super_admins_can_delete_all_teams" ON teams;
DROP POLICY IF EXISTS "super_admins_can_update_all_teams" ON teams;
DROP POLICY IF EXISTS "super_admins_can_view_all_teams" ON teams;
DROP POLICY IF EXISTS "team_members_can_view_their_teams" ON teams;
DROP POLICY IF EXISTS "members_cannot_update_teams" ON teams;
DROP POLICY IF EXISTS "members_cannot_delete_teams" ON teams;

-- Create single comprehensive policies for teams
-- SELECT: Team members can see their teams + super admins see all
CREATE POLICY "teams_select_policy" ON teams
  FOR SELECT
  USING (
    id = ANY (get_user_team_ids()) OR 
    public.is_super_admin()
  );

-- INSERT: Only service role can insert (for signups)
CREATE POLICY "teams_insert_policy" ON teams
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: Only team owners and super admins can update
CREATE POLICY "teams_update_policy" ON teams
  FOR UPDATE
  USING (
    public.user_team_role(id) = 'owner' OR 
    public.is_super_admin()
  );

-- DELETE: Only team owners and super admins can delete
CREATE POLICY "teams_delete_policy" ON teams
  FOR DELETE
  USING (
    public.user_team_role(id) = 'owner' OR 
    public.is_super_admin()
  );

-- Add helpful comments
COMMENT ON POLICY "team_members_select_policy" ON team_members IS 'Team members can see their own team members, super admins see all';
COMMENT ON POLICY "team_members_insert_policy" ON team_members IS 'Service role, super admins, and team owners/admins can add members with role restrictions';
COMMENT ON POLICY "team_members_update_policy" ON team_members IS 'Super admins and team owners/admins can update roles with restrictions';
COMMENT ON POLICY "team_members_delete_policy" ON team_members IS 'Super admins and team owners/admins can delete members with restrictions';
COMMENT ON POLICY "teams_select_policy" ON teams IS 'Team members see own teams, super admins see all';
COMMENT ON POLICY "teams_insert_policy" ON teams IS 'Only service role can create teams';
COMMENT ON POLICY "teams_update_policy" ON teams IS 'Only team owners and super admins can update teams';
COMMENT ON POLICY "teams_delete_policy" ON teams IS 'Only team owners and super admins can delete teams';
-- RLS Policies for Team Authentication System
-- This migration implements Row Level Security policies for all tables
-- Must be run after the declarative schema is applied

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role in a team
CREATE OR REPLACE FUNCTION public.user_team_role(team_id uuid)
RETURNS team_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM team_members 
  WHERE team_members.team_id = $1 
  AND team_members.user_id = auth.uid();
$$;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;

-- ============================================================================
-- TEAMS TABLE RLS POLICIES
-- ============================================================================

-- Teams: SELECT for team members
CREATE POLICY "team_members_can_select_own_team" ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Teams: UPDATE for owners only
CREATE POLICY "owners_can_update_team" ON teams
  FOR UPDATE
  USING (
    public.user_team_role(id) = 'owner'
  );

-- Teams: INSERT for service role only (handled by Edge Functions)
CREATE POLICY "service_role_can_insert_teams" ON teams
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Teams: DELETE for owners only
CREATE POLICY "owners_can_delete_team" ON teams
  FOR DELETE
  USING (
    public.user_team_role(id) = 'owner'
  );

-- ============================================================================
-- TEAM_MEMBERS TABLE RLS POLICIES
-- ============================================================================

-- Team Members: SELECT for members of same team
CREATE POLICY "team_members_can_select_same_team" ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Team Members: INSERT for admins/owners within team OR service role
CREATE POLICY "admins_owners_can_insert_members" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Team Members: UPDATE for admins/owners within team (role changes)
CREATE POLICY "admins_owners_can_update_members" ON team_members
  FOR UPDATE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    -- Prevent non-owners from creating/updating owners
    (NEW.role != 'owner' OR public.user_team_role(team_id) = 'owner') AND
    -- Prevent users from updating their own role
    user_id != auth.uid()
  );

-- Team Members: DELETE for admins/owners within team
CREATE POLICY "admins_owners_can_delete_members" ON team_members
  FOR DELETE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin') AND
    -- Prevent users from deleting themselves (use leave team function instead)
    user_id != auth.uid()
  );

-- Super admins have full access to team_members
CREATE POLICY "super_admins_full_access_team_members" ON team_members
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- INVITES TABLE RLS POLICIES
-- ============================================================================

-- Invites: SELECT for admins/owners within team
CREATE POLICY "admins_owners_can_select_invites" ON invites
  FOR SELECT
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: INSERT for admins/owners within team OR service role
CREATE POLICY "admins_owners_can_insert_invites" ON invites
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: UPDATE for admins/owners within team
CREATE POLICY "admins_owners_can_update_invites" ON invites
  FOR UPDATE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: DELETE for admins/owners within team
CREATE POLICY "admins_owners_can_delete_invites" ON invites
  FOR DELETE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Special policy: Allow invited users to see their own invites (for accept-invite flow)
CREATE POLICY "invited_users_can_select_own_invites" ON invites
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================================
-- IMPERSONATION_SESSIONS TABLE RLS POLICIES
-- ============================================================================

-- Impersonation Sessions: INSERT/UPDATE for service role only
CREATE POLICY "service_role_can_manage_impersonation" ON impersonation_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Impersonation Sessions: SELECT for super admins (own sessions only)
CREATE POLICY "super_admins_can_select_own_sessions" ON impersonation_sessions
  FOR SELECT
  USING (
    public.is_super_admin() AND admin_user_id = auth.uid()
  );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.user_team_role(uuid) IS 'Helper function to get current user role in specified team';
COMMENT ON FUNCTION public.is_super_admin() IS 'Helper function to check if current user is a super admin';

COMMENT ON POLICY "team_members_can_select_own_team" ON teams IS 'Team members can view their own team information';
COMMENT ON POLICY "owners_can_update_team" ON teams IS 'Only team owners can update team settings';
COMMENT ON POLICY "service_role_can_insert_teams" ON teams IS 'Teams are created through Edge Functions using service role';
COMMENT ON POLICY "owners_can_delete_team" ON teams IS 'Only team owners can delete teams';

COMMENT ON POLICY "team_members_can_select_same_team" ON team_members IS 'Team members can see other members in their team';
COMMENT ON POLICY "admins_owners_can_insert_members" ON team_members IS 'Admins and owners can add new team members';
COMMENT ON POLICY "admins_owners_can_update_members" ON team_members IS 'Admins and owners can change member roles (with restrictions)';
COMMENT ON POLICY "admins_owners_can_delete_members" ON team_members IS 'Admins and owners can remove team members';
COMMENT ON POLICY "super_admins_full_access_team_members" ON team_members IS 'Super admins have unrestricted access for management purposes';

COMMENT ON POLICY "admins_owners_can_select_invites" ON invites IS 'Admins and owners can view team invitations';
COMMENT ON POLICY "admins_owners_can_insert_invites" ON invites IS 'Admins and owners can create invitations';
COMMENT ON POLICY "admins_owners_can_update_invites" ON invites IS 'Admins and owners can modify invitations';
COMMENT ON POLICY "admins_owners_can_delete_invites" ON invites IS 'Admins and owners can revoke invitations';
COMMENT ON POLICY "invited_users_can_select_own_invites" ON invites IS 'Users can see invitations sent to their email address';

COMMENT ON POLICY "service_role_can_manage_impersonation" ON impersonation_sessions IS 'Impersonation is managed exclusively through Edge Functions';
COMMENT ON POLICY "super_admins_can_select_own_sessions" ON impersonation_sessions IS 'Super admins can view their own impersonation history';
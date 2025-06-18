-- Comprehensive RLS policy fix for proper role-based team management
-- This addresses missing super admin access, team member management, and profile visibility

-- ============================================================================
-- PROFILES TABLE: Add team member visibility
-- ============================================================================

-- Team members should be able to view profiles of other team members
CREATE POLICY "team_members_can_view_team_profiles" ON profiles
  FOR SELECT 
  USING (
    id IN (
      SELECT tm2.user_id 
      FROM team_members tm1
      INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
    )
  );

-- Super admins can view all profiles
CREATE POLICY "super_admins_can_view_all_profiles" ON profiles
  FOR SELECT 
  USING (public.is_super_admin());

-- ============================================================================
-- TEAM_MEMBERS TABLE: Add management policies
-- ============================================================================

-- Owners and admins can update team member roles (with restrictions)
CREATE POLICY "admins_owners_can_update_team_members" ON team_members
  FOR UPDATE
  USING (
    -- User must be admin or owner of this team
    public.user_team_role(team_id) IN ('owner', 'admin') AND
    -- Cannot modify their own role (prevents self-promotion)
    user_id != auth.uid()
  )
  WITH CHECK (
    -- Admins cannot promote to owner or modify owners/other admins
    CASE 
      WHEN public.user_team_role(team_id) = 'admin' THEN 
        role IN ('member', 'admin') AND 
        (SELECT role FROM team_members WHERE team_id = team_members.team_id AND user_id = team_members.user_id) != 'owner'
      WHEN public.user_team_role(team_id) = 'owner' THEN 
        true -- Owners can set any role except super_admin
      ELSE false
    END AND
    role != 'super_admin' -- Only super admins can assign super_admin
  );

-- Owners and admins can remove team members (with restrictions)  
CREATE POLICY "admins_owners_can_remove_team_members" ON team_members
  FOR DELETE
  USING (
    -- User must be admin or owner of this team
    public.user_team_role(team_id) IN ('owner', 'admin') AND
    -- Cannot remove themselves (use leave team function instead)
    user_id != auth.uid() AND
    -- Admins cannot remove owners or other admins
    CASE 
      WHEN public.user_team_role(team_id) = 'admin' THEN 
        (SELECT role FROM team_members WHERE team_id = team_members.team_id AND user_id = team_members.user_id) = 'member'
      WHEN public.user_team_role(team_id) = 'owner' THEN 
        (SELECT role FROM team_members WHERE team_id = team_members.team_id AND user_id = team_members.user_id) != 'super_admin'
      ELSE false
    END
  );

-- Owners and admins can add new team members
CREATE POLICY "admins_owners_can_add_team_members" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR -- Allow service role for signup
    (
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      role IN ('member', 'admin') AND -- Admins can only add members/admins, not owners
      (public.user_team_role(team_id) = 'owner' OR role = 'member') -- Admins can only add members
    )
  );

-- Super admins have full access to team_members
CREATE POLICY "super_admins_full_access_team_members" ON team_members
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- TEAMS TABLE: Add super admin access
-- ============================================================================

-- Super admins can view all teams
CREATE POLICY "super_admins_can_view_all_teams" ON teams
  FOR SELECT 
  USING (public.is_super_admin());

-- Super admins can update all teams
CREATE POLICY "super_admins_can_update_all_teams" ON teams
  FOR UPDATE 
  USING (public.is_super_admin());

-- Super admins can delete all teams
CREATE POLICY "super_admins_can_delete_all_teams" ON teams
  FOR DELETE 
  USING (public.is_super_admin());

-- ============================================================================
-- INVITES TABLE: Add super admin access
-- ============================================================================

-- Super admins can manage all invites
CREATE POLICY "super_admins_can_manage_all_invites" ON invites
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
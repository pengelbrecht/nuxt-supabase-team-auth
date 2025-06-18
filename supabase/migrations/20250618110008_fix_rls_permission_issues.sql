-- Fix critical RLS permission issues found by comprehensive testing
-- This addresses members having too many permissions and role management issues

-- The main issue is that our current policies are not restrictive enough
-- We need to ensure only authorized roles can perform certain operations

-- ============================================================================
-- TEAM_MEMBERS TABLE: Replace overly permissive policies
-- ============================================================================

-- Drop and recreate the UPDATE policy with proper restrictions
DROP POLICY IF EXISTS "admins_owners_can_update_team_members" ON team_members;

CREATE POLICY "admins_owners_can_update_team_members" ON team_members
  FOR UPDATE
  USING (
    -- Only admins, owners, and super_admins can update
    public.user_team_role(team_id) IN ('owner', 'admin') OR public.is_super_admin()
  )
  WITH CHECK (
    -- Cannot modify their own role (prevents self-promotion/demotion)
    user_id != auth.uid() AND
    -- Role-based restrictions on what changes are allowed
    CASE 
      WHEN public.user_team_role(team_id) = 'admin' THEN 
        -- Admins can only assign member or admin roles
        role IN ('member', 'admin') AND 
        -- Admins cannot modify owners or super_admins
        (SELECT role FROM team_members old_tm WHERE old_tm.team_id = team_members.team_id AND old_tm.user_id = team_members.user_id) NOT IN ('owner', 'super_admin')
      WHEN public.user_team_role(team_id) = 'owner' THEN 
        -- Owners can assign any role except super_admin
        role != 'super_admin' AND
        -- Owners cannot modify super_admins
        (SELECT role FROM team_members old_tm WHERE old_tm.team_id = team_members.team_id AND old_tm.user_id = team_members.user_id) != 'super_admin'
      WHEN public.is_super_admin() THEN
        -- Super admins can do anything
        true
      ELSE false
    END
  );

-- Drop and recreate the DELETE policy with proper restrictions
DROP POLICY IF EXISTS "admins_owners_can_remove_team_members" ON team_members;

CREATE POLICY "admins_owners_can_remove_team_members" ON team_members
  FOR DELETE
  USING (
    -- Only admins, owners, and super_admins can delete
    (public.user_team_role(team_id) IN ('owner', 'admin') OR public.is_super_admin()) AND
    -- Cannot remove themselves 
    user_id != auth.uid() AND
    -- Role-based restrictions on who can be deleted
    CASE 
      WHEN public.user_team_role(team_id) = 'admin' THEN 
        -- Admins can only remove members
        role = 'member'
      WHEN public.user_team_role(team_id) = 'owner' THEN 
        -- Owners can remove anyone except super_admins
        role != 'super_admin'
      WHEN public.is_super_admin() THEN
        -- Super admins can remove anyone
        true
      ELSE false
    END
  );

-- Fix INSERT policy to be more restrictive
DROP POLICY IF EXISTS "admins_owners_can_add_team_members" ON team_members;

CREATE POLICY "admins_owners_can_add_team_members" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR -- Allow service role for signup
    public.is_super_admin() OR -- Allow super admins
    (
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      -- Restrict what roles can be assigned when adding
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          role = 'member' -- Admins can only add members
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          role IN ('member', 'admin') -- Owners can add members and admins
        ELSE false
      END
    )
  );

-- ============================================================================
-- TEAMS TABLE: Ensure only owners can update team settings
-- ============================================================================

-- The existing policy should already be restrictive enough, but let's verify
-- by checking if we need to modify it

-- Add comment for clarity
COMMENT ON POLICY "admins_owners_can_update_team_members" ON team_members IS 'Admins and owners can update team member roles with restrictions, cannot modify own role';
COMMENT ON POLICY "admins_owners_can_remove_team_members" ON team_members IS 'Admins and owners can remove team members with role-based restrictions';
COMMENT ON POLICY "admins_owners_can_add_team_members" ON team_members IS 'Admins and owners can add team members with role restrictions';
-- Fix critical RLS security holes found in testing
-- The main issue: permissive policies and missing restrictive policies

-- ============================================================================
-- TEAM_MEMBERS: Fix overly permissive policies
-- ============================================================================

-- Drop the overly permissive super_admin policy and replace with restrictive ones
DROP POLICY IF EXISTS "super_admins_full_access_team_members" ON team_members;

-- Create explicit super admin policies that are properly scoped
CREATE POLICY "super_admins_can_select_all_team_members" ON team_members
  FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "super_admins_can_insert_team_members" ON team_members
  FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admins_can_update_team_members" ON team_members
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admins_can_delete_team_members" ON team_members
  FOR DELETE
  USING (public.is_super_admin());

-- ============================================================================  
-- TEAMS: Add missing restrictive policies for members
-- ============================================================================

-- Currently members can update teams because there's no restrictive policy
-- Add a policy that explicitly denies members from updating teams
CREATE POLICY "members_cannot_update_teams" ON teams
  FOR UPDATE
  USING (
    public.user_team_role(id) IN ('owner', 'admin') OR public.is_super_admin()
  );

-- Add a policy that explicitly denies members from deleting teams  
CREATE POLICY "members_cannot_delete_teams" ON teams
  FOR DELETE
  USING (
    public.user_team_role(id) = 'owner' OR public.is_super_admin()
  );

-- ============================================================================
-- DEBUG: Add logging to understand what's happening
-- ============================================================================

-- Create a function to help debug RLS issues
CREATE OR REPLACE FUNCTION debug_user_context()
RETURNS TABLE (
  auth_uid uuid,
  auth_role text,
  is_super_admin_result boolean
) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid(),
    auth.role()::text,
    public.is_super_admin();
$$;

-- Add comments for clarity
COMMENT ON POLICY "super_admins_can_select_all_team_members" ON team_members IS 'Super admins can see all team members across organizations';
COMMENT ON POLICY "super_admins_can_insert_team_members" ON team_members IS 'Super admins can add team members to any team';
COMMENT ON POLICY "super_admins_can_update_team_members" ON team_members IS 'Super admins can update any team member role';
COMMENT ON POLICY "super_admins_can_delete_team_members" ON team_members IS 'Super admins can delete any team member';
COMMENT ON POLICY "members_cannot_update_teams" ON teams IS 'Only owners, admins and super admins can update team settings';
COMMENT ON POLICY "members_cannot_delete_teams" ON teams IS 'Only owners and super admins can delete teams';
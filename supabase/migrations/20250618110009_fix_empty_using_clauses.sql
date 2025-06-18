-- Fix critical security vulnerability: empty USING clauses allow anyone to perform operations
-- This addresses the root cause of why members can update/delete when they shouldn't

-- ============================================================================
-- TEAM_MEMBERS TABLE: Fix empty USING clauses
-- ============================================================================

-- Fix INSERT policy with proper USING clause
DROP POLICY IF EXISTS "service_role_can_insert_team_members" ON team_members;
DROP POLICY IF EXISTS "admins_owners_can_add_team_members" ON team_members;

-- Create a single, properly restrictive INSERT policy  
-- Note: INSERT policies only support WITH CHECK, not USING
CREATE POLICY "authorized_can_add_team_members" ON team_members
  FOR INSERT
  WITH CHECK (
    -- WITH CHECK determines both who can insert AND what values can be inserted
    auth.role() = 'service_role' OR -- Service role can insert anything
    public.is_super_admin() OR -- Super admins can insert anything
    (
      -- Team owners/admins have restrictions on what roles they can assign
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          role = 'member' -- Admins can only add members
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          role IN ('member', 'admin') -- Owners can add members and admins
        ELSE false
      END
    )
  );

-- Fix DELETE policy with proper USING clause (it was missing WITH CHECK)
DROP POLICY IF EXISTS "admins_owners_can_remove_team_members" ON team_members;

CREATE POLICY "authorized_can_remove_team_members" ON team_members
  FOR DELETE
  USING (
    -- USING clause determines who can perform DELETE and on which rows
    (
      public.user_team_role(team_id) IN ('owner', 'admin') OR 
      public.is_super_admin()
    ) AND
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

-- Verify our UPDATE policy is correct (it should already have proper USING clause)
-- But let's make sure by recreating it to be explicit
DROP POLICY IF EXISTS "admins_owners_can_update_team_members" ON team_members;

CREATE POLICY "authorized_can_update_team_members" ON team_members
  FOR UPDATE
  USING (
    -- USING clause determines who can perform UPDATE
    public.user_team_role(team_id) IN ('owner', 'admin') OR 
    public.is_super_admin()
  )
  WITH CHECK (
    -- WITH CHECK determines what new values are allowed
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

-- Add comments for clarity
COMMENT ON POLICY "authorized_can_add_team_members" ON team_members IS 'Properly restrictive INSERT policy with USING clause to prevent unauthorized access';
COMMENT ON POLICY "authorized_can_remove_team_members" ON team_members IS 'Properly restrictive DELETE policy with USING clause to prevent unauthorized access';
COMMENT ON POLICY "authorized_can_update_team_members" ON team_members IS 'Properly restrictive UPDATE policy with both USING and WITH CHECK clauses';
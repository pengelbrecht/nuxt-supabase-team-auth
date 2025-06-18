-- Fix inconsistency: Allow admins to invite new admins directly
-- Currently admins can promote member → admin but cannot invite new admins
-- This makes the permissions consistent

-- Drop and recreate the team_members INSERT policy
DROP POLICY IF EXISTS "team_members_insert_policy" ON team_members;

-- CREATE: Allow admins to invite both members and admins (consistent with UPDATE policy)
CREATE POLICY "team_members_insert_policy" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR 
    public.is_super_admin() OR
    (
      public.user_team_role(team_id) IN ('owner', 'admin') AND
      CASE 
        WHEN public.user_team_role(team_id) = 'admin' THEN 
          role IN ('member', 'admin')  -- Changed: admins can now invite both members and admins
        WHEN public.user_team_role(team_id) = 'owner' THEN 
          role IN ('member', 'admin')  -- Unchanged: owners can invite members and admins
        ELSE false
      END
    )
  );

-- Add comment explaining the logic
COMMENT ON POLICY "team_members_insert_policy" ON team_members IS 
'Consistent permissions: admins can invite members/admins (same roles they can assign via promotion)';
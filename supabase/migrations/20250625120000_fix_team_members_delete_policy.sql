-- Fix team_members DELETE policy to allow proper cleanup
-- This addresses issues with user deletion from Supabase Auth

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "team_members_delete_policy" ON "public"."team_members";

-- Create a more flexible policy that allows:
-- 1. Service role operations (for Auth system cleanup)
-- 2. Super admin operations  
-- 3. Self-deletion (users can remove themselves - constraint will prevent last owner)
-- 4. Admin/Owner deletion of other members (existing logic)
CREATE POLICY "team_members_delete_policy" ON "public"."team_members"
  AS PERMISSIVE FOR DELETE
  TO public
  USING (
    -- Allow service role (for Auth system cleanup)
    auth.role() = 'service_role'
    OR
    -- Allow super admin
    is_super_admin() 
    OR
    -- Allow users to delete themselves (constraint will prevent last owner deletion)
    user_id = auth.uid()
    OR
    -- Allow admins/owners to delete other members (existing logic)
    (
      (user_team_role(team_id) = ANY (ARRAY['owner'::team_role, 'admin'::team_role])) 
      AND (user_id <> auth.uid()) 
      AND
      CASE
        WHEN (user_team_role(team_id) = 'admin'::team_role) THEN (role = 'member'::team_role)
        WHEN (user_team_role(team_id) = 'owner'::team_role) THEN (role <> 'super_admin'::team_role)
        ELSE false
      END
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "team_members_delete_policy" ON "public"."team_members" IS 
'Allows: service_role cleanup, super_admin, self-deletion, and admin/owner deletion of other members. The check_team_has_owner() trigger prevents deletion of the last owner.';
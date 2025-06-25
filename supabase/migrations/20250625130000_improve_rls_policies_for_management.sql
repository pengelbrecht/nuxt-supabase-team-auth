-- Improve RLS policies to allow proper management while maintaining security
-- This addresses issues with team creation, deletion, and admin operations

-- 1. Fix teams INSERT policy to allow normal user signups
DROP POLICY IF EXISTS "teams_insert_policy" ON "public"."teams";
CREATE POLICY "teams_insert_policy" ON "public"."teams"
  AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (
    -- Allow service role (for Edge Functions)
    auth.role() = 'service_role'
    OR
    -- Allow super admins
    is_super_admin()
    OR 
    -- Allow authenticated users (for normal signup - additional business logic in Edge Functions)
    auth.role() = 'authenticated'
  );

-- 2. Fix teams DELETE policy to allow service role bypass
DROP POLICY IF EXISTS "teams_delete_policy" ON "public"."teams";
CREATE POLICY "teams_delete_policy" ON "public"."teams"
  AS PERMISSIVE FOR DELETE
  TO public
  USING (
    -- Allow service role (for admin operations and cleanup)
    auth.role() = 'service_role'
    OR
    -- Allow super admin
    is_super_admin() 
    OR
    -- Allow team owners (but constraint will still prevent last owner deletion)
    user_team_role(id) = 'owner'::team_role
  );

-- 3. Fix teams UPDATE policy to allow service role
DROP POLICY IF EXISTS "teams_update_policy" ON "public"."teams";
CREATE POLICY "teams_update_policy" ON "public"."teams"
  AS PERMISSIVE FOR UPDATE
  TO public
  USING (
    -- Allow service role (for admin operations)
    auth.role() = 'service_role'
    OR
    -- Allow super admin
    is_super_admin()
    OR
    -- Allow team owners
    user_team_role(id) = 'owner'::team_role
  );

-- 4. Fix profiles DELETE policy to allow service role
DROP POLICY IF EXISTS "profiles_delete_own" ON "public"."profiles";
CREATE POLICY "profiles_delete_own" ON "public"."profiles"
  AS PERMISSIVE FOR DELETE
  TO public
  USING (
    -- Allow service role (for cleanup and admin operations)
    auth.role() = 'service_role'
    OR
    -- Allow super admin
    is_super_admin()
    OR
    -- Allow users to delete themselves
    auth.uid() = id
  );

-- Add comments explaining the policies
COMMENT ON POLICY "teams_insert_policy" ON "public"."teams" IS 
'Allows service_role, super_admin, and authenticated users to create teams. Business logic in Edge Functions handles validation.';

COMMENT ON POLICY "teams_delete_policy" ON "public"."teams" IS 
'Allows service_role, super_admin, and team owners to delete teams. The ensure_team_has_owner trigger prevents deletion of teams with only one owner.';

COMMENT ON POLICY "teams_update_policy" ON "public"."teams" IS 
'Allows service_role, super_admin, and team owners to update team information.';

COMMENT ON POLICY "profiles_delete_own" ON "public"."profiles" IS 
'Allows service_role, super_admin, and users to delete their own profiles. Service role needed for Auth system cleanup.';
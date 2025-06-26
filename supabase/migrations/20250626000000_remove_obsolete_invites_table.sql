-- Remove obsolete invites table and related policies
-- This table is no longer used as we've migrated to Supabase's native auth.users invitation system

-- Drop RLS policies for invites table
DROP POLICY IF EXISTS "admins_owners_can_delete_invites" ON "public"."invites";
DROP POLICY IF EXISTS "admins_owners_can_insert_invites" ON "public"."invites";
DROP POLICY IF EXISTS "admins_owners_can_select_invites" ON "public"."invites";
DROP POLICY IF EXISTS "admins_owners_can_update_invites" ON "public"."invites";
DROP POLICY IF EXISTS "invited_users_can_select_own_invites" ON "public"."invites";
DROP POLICY IF EXISTS "super_admins_can_manage_all_invites" ON "public"."invites";

-- Drop indexes
DROP INDEX IF EXISTS "invites_email_idx";
DROP INDEX IF EXISTS "invites_expires_at_idx";
DROP INDEX IF EXISTS "invites_token_hash_idx";

-- Drop constraints
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_team_id_email_status_key";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_token_hash_key";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_invited_by_fkey";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_team_id_fkey";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_email_format";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_expires_future";
ALTER TABLE IF EXISTS "public"."invites" DROP CONSTRAINT IF EXISTS "invites_status_check";

-- Drop the table
DROP TABLE IF EXISTS "public"."invites";

-- Add comment to document the change
COMMENT ON SCHEMA "public" IS 'Removed obsolete invites table - now using Supabase native auth.users invitation system';


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."team_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'super_admin'
);


ALTER TYPE "public"."team_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_team_has_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- On UPDATE or DELETE, check if we're removing the last owner
  IF TG_OP = 'UPDATE' THEN
    -- If changing FROM owner role, check if there are other owners
    IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
      -- Count remaining owners for this team (excluding this row)
      IF (
        SELECT COUNT(*) 
        FROM team_members 
        WHERE team_id = NEW.team_id 
        AND role = 'owner' 
        AND user_id != NEW.user_id
      ) = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last owner from team. Teams must have at least one owner.';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- If deleting an owner, check if there are other owners
    IF OLD.role = 'owner' THEN
      -- Count remaining owners for this team (excluding this row)
      IF (
        SELECT COUNT(*) 
        FROM team_members 
        WHERE team_id = OLD.team_id 
        AND role = 'owner' 
        AND user_id != OLD.user_id
      ) = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last owner from team. Teams must have at least one owner.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."check_team_has_owner"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_team_has_owner"() IS 'Ensures teams always have at least one owner. Prevents deletion or role change of the last owner.';



CREATE OR REPLACE FUNCTION "public"."cleanup_all_test_data"() RETURNS TABLE("users_deleted" integer, "teams_deleted" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  test_user_count integer := 0;
  test_team_count integer := 0;
  team_record record;
BEGIN
  -- Temporarily disable the trigger that prevents deleting team owners
  ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
  
  -- First, identify and delete all teams that have test users as members
  FOR team_record IN
    SELECT DISTINCT tm.team_id, t.name
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN profiles p ON tm.user_id = p.id
    WHERE p.email LIKE '%@example.com'
  LOOP
    -- Delete all team members for this team
    DELETE FROM team_members WHERE team_id = team_record.team_id;
    
    -- Delete the team
    DELETE FROM teams WHERE id = team_record.team_id;
    
    test_team_count := test_team_count + 1;
    RAISE NOTICE 'Deleted test team: % (%)', team_record.name, team_record.team_id;
  END LOOP;
  
  -- Re-enable the trigger
  ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
  
  -- Now delete all test users from auth.users (this will cascade to profiles)
  -- We need to use the auth schema for this
  DELETE FROM auth.users 
  WHERE email LIKE '%@example.com';
  
  -- Get the count of deleted users
  GET DIAGNOSTICS test_user_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % test users and % test teams', test_user_count, test_team_count;
  
  users_deleted := test_user_count;
  teams_deleted := test_team_count;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."cleanup_all_test_data"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_all_test_data"() IS 'Cleanup function for all test data. Use only in test environments.';



CREATE OR REPLACE FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Temporarily disable the trigger to allow cleanup
  ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
  
  -- Delete all team members for this team
  DELETE FROM team_members WHERE team_id = team_id_param;
  
  -- Re-enable the trigger
  ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
  
  -- Delete the team itself
  DELETE FROM teams WHERE id = team_id_param;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up test team %', team_id_param;
END;
$$;


ALTER FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") IS 'Cleanup function for test teams that bypasses owner constraints. Use only in test environments.';



CREATE OR REPLACE FUNCTION "public"."debug_user_context"() RETURNS TABLE("auth_uid" "uuid", "auth_role" "text", "is_super_admin_result" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    auth.uid(),
    auth.role()::text,
    public.is_super_admin();
$$;


ALTER FUNCTION "public"."debug_user_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY(
    SELECT user_id 
    FROM team_members 
    WHERE team_id = team_uuid
  );
$$;


ALTER FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") IS 'Get member user IDs for a team without triggering RLS recursion';



CREATE OR REPLACE FUNCTION "public"."get_team_members_with_profiles"("team_id_param" "uuid") RETURNS TABLE("user_id" "uuid", "role" "public"."team_role", "joined_at" timestamp with time zone, "full_name" "text", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 
        tm.user_id,
        tm.role,
        tm.joined_at,
        p.full_name,
        p.email
    FROM team_members tm
    INNER JOIN profiles p ON tm.user_id = p.id
    WHERE tm.team_id = team_id_param
    ORDER BY tm.joined_at ASC;
$$;


ALTER FUNCTION "public"."get_team_members_with_profiles"("team_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_test_user_ids"() RETURNS TABLE("user_id" "uuid", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id, p.email 
  FROM profiles p
  WHERE p.email LIKE '%@example.com';
$$;


ALTER FUNCTION "public"."get_test_user_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_test_user_ids"() IS 'Get all test user IDs for cleanup purposes.';



CREATE OR REPLACE FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid" DEFAULT "auth"."uid"()) RETURNS "uuid"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY(
    SELECT team_id 
    FROM team_members 
    WHERE user_id = user_uuid
  );
$$;


ALTER FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid") IS 'Get team IDs for a user without triggering RLS recursion';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        new.email
    );
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_email_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update email in profiles when it changes in auth.users
    UPDATE public.profiles 
    SET email = NEW.email 
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_super_admin"() IS 'Helper function to check if current user is a super admin';



CREATE OR REPLACE FUNCTION "public"."update_impersonation_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_impersonation_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_team_role"("team_id" "uuid") RETURNS "public"."team_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  SELECT role FROM team_members 
  WHERE team_members.team_id = $1 
  AND team_members.user_id = auth.uid();
$_$;


ALTER FUNCTION "public"."user_team_role"("team_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_team_role"("team_id" "uuid") IS 'Helper function to get current user role in specified team';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "reason" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:30:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "impersonation_different_users" CHECK (("admin_user_id" <> "target_user_id")),
    CONSTRAINT "impersonation_end_after_start" CHECK ((("ended_at" IS NULL) OR ("ended_at" > "started_at"))),
    CONSTRAINT "impersonation_reason_not_empty" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0))
);


ALTER TABLE "public"."impersonation_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."impersonation_sessions" IS 'Audit log for super-admin impersonation sessions. Session restoration uses JWT cookies + magic links.';



COMMENT ON COLUMN "public"."impersonation_sessions"."reason" IS 'Reason for impersonation (audit purposes).';



COMMENT ON COLUMN "public"."impersonation_sessions"."expires_at" IS 'When the impersonation session expires automatically';



CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "role" "public"."team_role" DEFAULT 'member'::"public"."team_role" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    CONSTRAINT "invites_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "invites_expires_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


COMMENT ON TABLE "public"."invites" IS 'Pending team invitations sent via email.';



COMMENT ON COLUMN "public"."invites"."token_hash" IS 'Hashed invitation token for security.';



COMMENT ON COLUMN "public"."invites"."expires_at" IS 'When the invitation expires.';



COMMENT ON COLUMN "public"."invites"."status" IS 'Invitation status: pending, accepted, or revoked.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "bio" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "language" "text" DEFAULT 'en'::"text",
    "email_notifications" boolean DEFAULT true,
    "marketing_emails" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."team_role" DEFAULT 'member'::"public"."team_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'Team membership with roles. Multiple owners per team are allowed for flexible ownership models.';



COMMENT ON COLUMN "public"."team_members"."role" IS 'User role within the team: owner, admin, member, or super_admin.';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text",
    "company_address_line1" "text",
    "company_address_line2" "text",
    "company_city" "text",
    "company_state" "text",
    "company_postal_code" "text",
    "company_country" "text",
    "company_vat_number" "text",
    CONSTRAINT "teams_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Teams in the system. Each team can have multiple members with different roles.';



COMMENT ON COLUMN "public"."teams"."name" IS 'Team display name, must be non-empty.';



COMMENT ON COLUMN "public"."teams"."vat_number" IS 'VAT/Tax number for team settings.';



COMMENT ON COLUMN "public"."teams"."company_name" IS 'Legal company name for invoicing';



COMMENT ON COLUMN "public"."teams"."company_address_line1" IS 'Primary address line for company headquarters';



COMMENT ON COLUMN "public"."teams"."company_address_line2" IS 'Secondary address line (apartment, suite, etc.)';



COMMENT ON COLUMN "public"."teams"."company_city" IS 'City for company address';



COMMENT ON COLUMN "public"."teams"."company_state" IS 'State/Province for company address';



COMMENT ON COLUMN "public"."teams"."company_postal_code" IS 'Postal/ZIP code for company address';



COMMENT ON COLUMN "public"."teams"."company_country" IS 'Country for company address';



COMMENT ON COLUMN "public"."teams"."company_vat_number" IS 'VAT/Tax identification number';



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_team_id_email_status_key" UNIQUE ("team_id", "email", "status");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_impersonation_sessions_expires_at" ON "public"."impersonation_sessions" USING "btree" ("expires_at");



CREATE INDEX "impersonation_sessions_admin_user_id_idx" ON "public"."impersonation_sessions" USING "btree" ("admin_user_id");



CREATE INDEX "impersonation_sessions_started_at_idx" ON "public"."impersonation_sessions" USING "btree" ("started_at");



CREATE INDEX "impersonation_sessions_target_user_id_idx" ON "public"."impersonation_sessions" USING "btree" ("target_user_id");



CREATE INDEX "invites_email_idx" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "invites_expires_at_idx" ON "public"."invites" USING "btree" ("expires_at");



CREATE INDEX "invites_token_hash_idx" ON "public"."invites" USING "btree" ("token_hash");



CREATE INDEX "profiles_full_name_idx" ON "public"."profiles" USING "gin" ("to_tsvector"('"english"'::"regconfig", "full_name"));



CREATE INDEX "profiles_updated_at_idx" ON "public"."profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "team_members_team_id_role_idx" ON "public"."team_members" USING "btree" ("team_id", "role");



CREATE INDEX "team_members_user_id_idx" ON "public"."team_members" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "ensure_team_has_owner" BEFORE DELETE OR UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_team_has_owner"();



CREATE OR REPLACE TRIGGER "impersonation_sessions_updated_at" BEFORE UPDATE ON "public"."impersonation_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_impersonation_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "fk_team_members_profiles" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "admins_owners_can_delete_invites" ON "public"."invites" FOR DELETE USING (("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])));



CREATE POLICY "admins_owners_can_insert_invites" ON "public"."invites" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"]))));



CREATE POLICY "admins_owners_can_select_invites" ON "public"."invites" FOR SELECT USING (("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])));



CREATE POLICY "admins_owners_can_update_invites" ON "public"."invites" FOR UPDATE USING (("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])));



ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invited_users_can_select_own_invites" ON "public"."invites" FOR SELECT USING (("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text"));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_team_members" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."team_members" "tm1"
     JOIN "public"."team_members" "tm2" ON (("tm1"."team_id" = "tm2"."team_id")))
  WHERE (("tm1"."user_id" = "auth"."uid"()) AND ("tm2"."user_id" = "profiles"."id") AND ("tm1"."role" = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role", 'super_admin'::"public"."team_role"]))))));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_team_members" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."team_members" "tm1"
     JOIN "public"."team_members" "tm2" ON (("tm1"."team_id" = "tm2"."team_id")))
  WHERE (("tm1"."user_id" = "auth"."uid"()) AND ("tm2"."user_id" = "profiles"."id") AND ("tm1"."role" = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role", 'super_admin'::"public"."team_role"])) AND ("tm1"."user_id" <> "profiles"."id")))));



CREATE POLICY "service_role_can_manage_impersonation" ON "public"."impersonation_sessions" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "super_admins_can_manage_all_invites" ON "public"."invites" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admins_can_select_own_sessions" ON "public"."impersonation_sessions" FOR SELECT USING (("public"."is_super_admin"() AND ("admin_user_id" = "auth"."uid"())));



CREATE POLICY "super_admins_can_view_all_profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_super_admin"());



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_can_view_team_profiles" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("id" IN ( SELECT "unnest"("public"."get_team_member_ids"("team_id"."team_id")) AS "unnest"
   FROM "unnest"("public"."get_user_team_ids"()) "team_id"("team_id")))));



CREATE POLICY "team_members_delete_policy" ON "public"."team_members" FOR DELETE USING (("public"."is_super_admin"() OR (("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])) AND ("user_id" <> "auth"."uid"()) AND
CASE
    WHEN ("public"."user_team_role"("team_id") = 'admin'::"public"."team_role") THEN ("role" = 'member'::"public"."team_role")
    WHEN ("public"."user_team_role"("team_id") = 'owner'::"public"."team_role") THEN ("role" <> 'super_admin'::"public"."team_role")
    ELSE false
END)));



COMMENT ON POLICY "team_members_delete_policy" ON "public"."team_members" IS 'Super admins and team owners/admins can delete members with restrictions';



CREATE POLICY "team_members_insert_policy" ON "public"."team_members" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR "public"."is_super_admin"() OR (("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])) AND
CASE
    WHEN ("public"."user_team_role"("team_id") = 'admin'::"public"."team_role") THEN ("role" = ANY (ARRAY['member'::"public"."team_role", 'admin'::"public"."team_role"]))
    WHEN ("public"."user_team_role"("team_id") = 'owner'::"public"."team_role") THEN ("role" = ANY (ARRAY['member'::"public"."team_role", 'admin'::"public"."team_role"]))
    ELSE false
END)));



COMMENT ON POLICY "team_members_insert_policy" ON "public"."team_members" IS 'Consistent permissions: admins can invite members/admins (same roles they can assign via promotion)';



CREATE POLICY "team_members_select_policy" ON "public"."team_members" FOR SELECT USING ((("team_id" = ANY ("public"."get_user_team_ids"())) OR "public"."is_super_admin"()));



COMMENT ON POLICY "team_members_select_policy" ON "public"."team_members" IS 'Team members can see their own team members, super admins see all';



CREATE POLICY "team_members_update_policy" ON "public"."team_members" FOR UPDATE USING (("public"."is_super_admin"() OR ("public"."user_team_role"("team_id") = ANY (ARRAY['owner'::"public"."team_role", 'admin'::"public"."team_role"])))) WITH CHECK (("public"."is_super_admin"() OR (("user_id" <> "auth"."uid"()) AND
CASE
    WHEN ("public"."user_team_role"("team_id") = 'admin'::"public"."team_role") THEN (("role" = ANY (ARRAY['member'::"public"."team_role", 'admin'::"public"."team_role"])) AND (( SELECT "old_tm"."role"
       FROM "public"."team_members" "old_tm"
      WHERE (("old_tm"."team_id" = "team_members"."team_id") AND ("old_tm"."user_id" = "team_members"."user_id"))) = 'member'::"public"."team_role"))
    WHEN ("public"."user_team_role"("team_id") = 'owner'::"public"."team_role") THEN (("role" <> 'super_admin'::"public"."team_role") AND (( SELECT "old_tm"."role"
       FROM "public"."team_members" "old_tm"
      WHERE (("old_tm"."team_id" = "team_members"."team_id") AND ("old_tm"."user_id" = "team_members"."user_id"))) <> 'super_admin'::"public"."team_role"))
    ELSE false
END)));



COMMENT ON POLICY "team_members_update_policy" ON "public"."team_members" IS 'Super admins and team owners/admins can update roles with restrictions';



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete_policy" ON "public"."teams" FOR DELETE USING ((("public"."user_team_role"("id") = 'owner'::"public"."team_role") OR "public"."is_super_admin"()));



COMMENT ON POLICY "teams_delete_policy" ON "public"."teams" IS 'Only team owners and super admins can delete teams';



CREATE POLICY "teams_insert_policy" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



COMMENT ON POLICY "teams_insert_policy" ON "public"."teams" IS 'Only service role can create teams';



CREATE POLICY "teams_select_policy" ON "public"."teams" FOR SELECT USING ((("id" = ANY ("public"."get_user_team_ids"())) OR "public"."is_super_admin"()));



COMMENT ON POLICY "teams_select_policy" ON "public"."teams" IS 'Team members see own teams, super admins see all';



CREATE POLICY "teams_update_policy" ON "public"."teams" FOR UPDATE USING ((("public"."user_team_role"("id") = 'owner'::"public"."team_role") OR "public"."is_super_admin"()));



COMMENT ON POLICY "teams_update_policy" ON "public"."teams" IS 'Only team owners and super admins can update teams';





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."check_team_has_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_team_has_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_team_has_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_all_test_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_all_test_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_all_test_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_test_team"("team_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_user_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_user_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_user_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_member_ids"("team_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_members_with_profiles"("team_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_members_with_profiles"("team_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_members_with_profiles"("team_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_test_user_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_test_user_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_test_user_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_team_ids"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_email_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_email_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_email_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_impersonation_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_impersonation_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_impersonation_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_team_role"("team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_team_role"("team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_team_role"("team_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."impersonation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;

--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "on_auth_user_email_updated" AFTER UPDATE OF "email" ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_email_change"();




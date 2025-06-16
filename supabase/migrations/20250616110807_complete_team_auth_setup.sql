-- Complete Team Authentication Setup
-- This migration creates the entire schema from scratch

-- ============================================================================
-- EXTENSIONS AND TYPES
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types/enums for team authentication
DO $$ BEGIN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Teams table - Core team information
CREATE TABLE IF NOT EXISTS teams (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    address text,
    vat_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT teams_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Team Members table - Links users to teams with roles
CREATE TABLE IF NOT EXISTS team_members (
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'member',
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    PRIMARY KEY (team_id, user_id)
);

-- Invites table - Pending team invitations
CREATE TABLE IF NOT EXISTS invites (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    role team_role NOT NULL DEFAULT 'member',
    expires_at timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_by uuid REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT invites_expires_future CHECK (expires_at > created_at),
    UNIQUE (team_id, email, status) -- Prevent duplicate pending invites
);

-- Impersonation Sessions table - Audit trail for super admin impersonation
CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_user_id uuid NOT NULL REFERENCES auth.users(id),
    target_user_id uuid NOT NULL REFERENCES auth.users(id),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    reason text NOT NULL,
    
    -- Constraints
    CONSTRAINT impersonation_different_users CHECK (admin_user_id != target_user_id),
    CONSTRAINT impersonation_reason_not_empty CHECK (length(trim(reason)) > 0),
    CONSTRAINT impersonation_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_role_idx ON team_members(team_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_owner ON team_members(team_id) WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS invites_email_idx ON invites(email);
CREATE INDEX IF NOT EXISTS invites_token_hash_idx ON invites(token_hash);
CREATE INDEX IF NOT EXISTS invites_expires_at_idx ON invites(expires_at);

CREATE INDEX IF NOT EXISTS impersonation_sessions_admin_user_id_idx ON impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS impersonation_sessions_target_user_id_idx ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS impersonation_sessions_started_at_idx ON impersonation_sessions(started_at);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

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
DROP POLICY IF EXISTS "team_members_can_select_own_team" ON teams;
CREATE POLICY "team_members_can_select_own_team" ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Teams: UPDATE for owners only
DROP POLICY IF EXISTS "owners_can_update_team" ON teams;
CREATE POLICY "owners_can_update_team" ON teams
  FOR UPDATE
  USING (
    public.user_team_role(id) = 'owner'
  );

-- Teams: INSERT for service role only (handled by Edge Functions)
DROP POLICY IF EXISTS "service_role_can_insert_teams" ON teams;
CREATE POLICY "service_role_can_insert_teams" ON teams
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Teams: DELETE for owners only
DROP POLICY IF EXISTS "owners_can_delete_team" ON teams;
CREATE POLICY "owners_can_delete_team" ON teams
  FOR DELETE
  USING (
    public.user_team_role(id) = 'owner'
  );

-- ============================================================================
-- TEAM_MEMBERS TABLE RLS POLICIES
-- ============================================================================

-- Team Members: SELECT for members of same team
DROP POLICY IF EXISTS "team_members_can_select_same_team" ON team_members;
CREATE POLICY "team_members_can_select_same_team" ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Team Members: INSERT for admins/owners within team OR service role
DROP POLICY IF EXISTS "admins_owners_can_insert_members" ON team_members;
CREATE POLICY "admins_owners_can_insert_members" ON team_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Team Members: UPDATE for admins/owners within team (role changes)
DROP POLICY IF EXISTS "admins_owners_can_update_members" ON team_members;
CREATE POLICY "admins_owners_can_update_members" ON team_members
  FOR UPDATE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    -- Prevent non-owners from creating/updating owners
    (role != 'owner' OR public.user_team_role(team_id) = 'owner') AND
    -- Prevent users from updating their own role
    user_id != auth.uid()
  );

-- Team Members: DELETE for admins/owners within team
DROP POLICY IF EXISTS "admins_owners_can_delete_members" ON team_members;
CREATE POLICY "admins_owners_can_delete_members" ON team_members
  FOR DELETE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin') AND
    -- Prevent users from deleting themselves (use leave team function instead)
    user_id != auth.uid()
  );

-- Super admins have full access to team_members
DROP POLICY IF EXISTS "super_admins_full_access_team_members" ON team_members;
CREATE POLICY "super_admins_full_access_team_members" ON team_members
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- INVITES TABLE RLS POLICIES
-- ============================================================================

-- Invites: SELECT for admins/owners within team
DROP POLICY IF EXISTS "admins_owners_can_select_invites" ON invites;
CREATE POLICY "admins_owners_can_select_invites" ON invites
  FOR SELECT
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: INSERT for admins/owners within team OR service role
DROP POLICY IF EXISTS "admins_owners_can_insert_invites" ON invites;
CREATE POLICY "admins_owners_can_insert_invites" ON invites
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: UPDATE for admins/owners within team
DROP POLICY IF EXISTS "admins_owners_can_update_invites" ON invites;
CREATE POLICY "admins_owners_can_update_invites" ON invites
  FOR UPDATE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Invites: DELETE for admins/owners within team
DROP POLICY IF EXISTS "admins_owners_can_delete_invites" ON invites;
CREATE POLICY "admins_owners_can_delete_invites" ON invites
  FOR DELETE
  USING (
    public.user_team_role(team_id) IN ('owner', 'admin')
  );

-- Special policy: Allow invited users to see their own invites (for accept-invite flow)
DROP POLICY IF EXISTS "invited_users_can_select_own_invites" ON invites;
CREATE POLICY "invited_users_can_select_own_invites" ON invites
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================================
-- IMPERSONATION_SESSIONS TABLE RLS POLICIES
-- ============================================================================

-- Impersonation Sessions: INSERT/UPDATE for service role only
DROP POLICY IF EXISTS "service_role_can_manage_impersonation" ON impersonation_sessions;
CREATE POLICY "service_role_can_manage_impersonation" ON impersonation_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Impersonation Sessions: SELECT for super admins (own sessions only)
DROP POLICY IF EXISTS "super_admins_can_select_own_sessions" ON impersonation_sessions;
CREATE POLICY "super_admins_can_select_own_sessions" ON impersonation_sessions
  FOR SELECT
  USING (
    public.is_super_admin() AND admin_user_id = auth.uid()
  );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Table comments
COMMENT ON TABLE teams IS 'Teams in the system. Each team can have multiple members with different roles.';
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with their roles.';
COMMENT ON TABLE invites IS 'Pending team invitations sent via email.';
COMMENT ON TABLE impersonation_sessions IS 'Audit trail for super admin impersonation sessions.';

-- Column comments
COMMENT ON COLUMN teams.name IS 'Team display name, must be non-empty.';
COMMENT ON COLUMN teams.address IS 'Legal address for team settings.';
COMMENT ON COLUMN teams.vat_number IS 'VAT/Tax number for team settings.';
COMMENT ON COLUMN team_members.role IS 'User role within the team: owner, admin, member, or super_admin.';
COMMENT ON COLUMN invites.token_hash IS 'Hashed invitation token for security.';
COMMENT ON COLUMN invites.expires_at IS 'When the invitation expires.';
COMMENT ON COLUMN invites.status IS 'Invitation status: pending, accepted, or revoked.';
COMMENT ON COLUMN impersonation_sessions.reason IS 'Reason for impersonation (audit purposes).';

-- Function comments
COMMENT ON FUNCTION public.user_team_role(uuid) IS 'Helper function to get current user role in specified team';
COMMENT ON FUNCTION public.is_super_admin() IS 'Helper function to check if current user is a super admin';
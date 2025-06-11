-- Migration: Create RLS Policies for Team Auth
-- Version: 0.1.0
-- Date: 2025-01-06
-- Note: RLS policies must be created in migrations, not schema.sql

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Teams table RLS policies
-- Policy: Team members can SELECT their team
CREATE POLICY "team_members_can_select_their_team" ON teams
    FOR SELECT
    USING (
        id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Only team owners can UPDATE their team
CREATE POLICY "team_owners_can_update_their_team" ON teams
    FOR UPDATE
    USING (
        id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid() 
            AND role = 'owner'
        )
    );

-- Policy: Service role can INSERT/DELETE teams (for edge functions)
CREATE POLICY "service_role_teams_access" ON teams
    FOR ALL
    USING (auth.role() = 'service_role');

-- Team members table RLS policies
-- Policy: Team members can SELECT other members in their teams
CREATE POLICY "team_members_can_select_same_team" ON team_members
    FOR SELECT
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Admins and owners can INSERT/DELETE members in their teams
CREATE POLICY "team_admins_can_manage_members" ON team_members
    FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "team_admins_can_delete_members" ON team_members
    FOR DELETE
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Policy: Admins and owners can UPDATE member roles (for promotions/demotions)
CREATE POLICY "team_admins_can_update_member_roles" ON team_members
    FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Policy: Super admins have full access across all teams
CREATE POLICY "super_admins_full_access_team_members" ON team_members
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT user_id 
            FROM team_members 
            WHERE role = 'super_admin'
        )
    );

-- Policy: Service role can manage team members (for edge functions)
CREATE POLICY "service_role_team_members_access" ON team_members
    FOR ALL
    USING (auth.role() = 'service_role');

-- Invites table RLS policies
-- Policy: Team admins and owners can manage invites for their teams
CREATE POLICY "team_admins_can_manage_invites" ON invites
    FOR ALL
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Policy: Invitees can SELECT their own pending invites by email
-- Note: This allows users to see invites sent to their email address
CREATE POLICY "invitees_can_select_own_invites" ON invites
    FOR SELECT
    USING (
        email = (
            SELECT email 
            FROM auth.users 
            WHERE id = auth.uid()
        )
        AND status = 'pending'
    );

-- Policy: Service role can manage invites (for edge functions)
CREATE POLICY "service_role_invites_access" ON invites
    FOR ALL
    USING (auth.role() = 'service_role');

-- Impersonation sessions table RLS policies
-- Policy: Only service role can INSERT/UPDATE impersonation sessions
CREATE POLICY "service_role_impersonation_write" ON impersonation_sessions
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_impersonation_update" ON impersonation_sessions
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Policy: Super admins can SELECT their own impersonation sessions
CREATE POLICY "super_admins_can_select_own_sessions" ON impersonation_sessions
    FOR SELECT
    USING (
        admin_user_id = auth.uid()
        AND auth.uid() IN (
            SELECT user_id 
            FROM team_members 
            WHERE role = 'super_admin'
        )
    );

-- Add comments explaining the security model
COMMENT ON POLICY "team_members_can_select_their_team" ON teams IS 'Team members can view details of teams they belong to';
COMMENT ON POLICY "team_owners_can_update_their_team" ON teams IS 'Only team owners can modify team settings like name, address, VAT number';
COMMENT ON POLICY "service_role_teams_access" ON teams IS 'Service role has full access for edge function operations';

COMMENT ON POLICY "team_members_can_select_same_team" ON team_members IS 'Team members can see other members in their teams';
COMMENT ON POLICY "team_admins_can_manage_members" ON team_members IS 'Admins and owners can add members to their teams';
COMMENT ON POLICY "team_admins_can_delete_members" ON team_members IS 'Admins and owners can remove members from their teams';
COMMENT ON POLICY "super_admins_full_access_team_members" ON team_members IS 'Super admins have cross-team access for support purposes';

COMMENT ON POLICY "team_admins_can_manage_invites" ON invites IS 'Admins and owners can create, view, and revoke invites for their teams';
COMMENT ON POLICY "invitees_can_select_own_invites" ON invites IS 'Users can see pending invitations sent to their email address';

COMMENT ON POLICY "service_role_impersonation_write" ON impersonation_sessions IS 'Only service role can create/update impersonation sessions for security';
COMMENT ON POLICY "super_admins_can_select_own_sessions" ON impersonation_sessions IS 'Super admins can view audit log of their own impersonation sessions';
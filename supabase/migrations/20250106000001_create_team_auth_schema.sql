-- Migration: Create Team Auth Schema
-- Version: 0.1.0
-- Date: 2025-01-06

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'super_admin');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked');

-- Create teams table
CREATE TABLE teams (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    address text,
    vat_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create team_members table (junction table between auth.users and teams)
CREATE TABLE team_members (
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'member',
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (team_id, user_id)
);

-- Create invites table
CREATE TABLE invites (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    status invite_status NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create impersonation_sessions table
CREATE TABLE impersonation_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    reason text NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_invites_team_id ON invites(team_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_token_hash ON invites(token_hash);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);
CREATE INDEX idx_impersonation_sessions_admin_user_id ON impersonation_sessions(admin_user_id);
CREATE INDEX idx_impersonation_sessions_target_user_id ON impersonation_sessions(target_user_id);
CREATE INDEX idx_impersonation_sessions_started_at ON impersonation_sessions(started_at);

-- Add constraints
ALTER TABLE teams ADD CONSTRAINT teams_name_not_empty CHECK (length(trim(name)) > 0);
ALTER TABLE invites ADD CONSTRAINT invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE invites ADD CONSTRAINT invites_expires_at_future CHECK (expires_at > created_at);
ALTER TABLE impersonation_sessions ADD CONSTRAINT impersonation_sessions_different_users CHECK (admin_user_id != target_user_id);
ALTER TABLE impersonation_sessions ADD CONSTRAINT impersonation_sessions_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at);

-- Ensure only one owner per team
CREATE UNIQUE INDEX idx_team_members_unique_owner ON team_members(team_id) WHERE role = 'owner';

-- Add comments for documentation
COMMENT ON TABLE teams IS 'Teams in the system. Each team can have multiple members with different roles.';
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with their roles. One user per team (v1).';
COMMENT ON TABLE invites IS 'Team invitations sent via email with secure token-based acceptance.';
COMMENT ON TABLE impersonation_sessions IS 'Audit log for super-admin impersonation sessions with 1-year retention.';

COMMENT ON COLUMN teams.name IS 'Team display name, must be non-empty.';
COMMENT ON COLUMN teams.address IS 'Legal address for team settings.';
COMMENT ON COLUMN teams.vat_number IS 'VAT/Tax number for team settings.';

COMMENT ON COLUMN team_members.role IS 'User role within the team: owner (1 per team), admin, member, super_admin.';
COMMENT ON COLUMN team_members.joined_at IS 'When the user joined or was added to the team.';

COMMENT ON COLUMN invites.token_hash IS 'Hashed invitation token for security. Never store plain tokens.';
COMMENT ON COLUMN invites.expires_at IS 'Invitation expiry time (typically 7 days from creation).';
COMMENT ON COLUMN invites.status IS 'Current status of the invitation.';

COMMENT ON COLUMN impersonation_sessions.reason IS 'Required business justification for impersonation.';
COMMENT ON COLUMN impersonation_sessions.ended_at IS 'When impersonation ended (NULL if still active).';
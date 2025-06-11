-- Team members table - Junction table between auth.users and teams
CREATE TABLE team_members (
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role team_role NOT NULL DEFAULT 'member',
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Primary key
    PRIMARY KEY (team_id, user_id)
);

-- Indexes
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_role ON team_members(role);

-- Ensure only one owner per team
CREATE UNIQUE INDEX idx_team_members_unique_owner ON team_members(team_id) WHERE role = 'owner';

-- Comments
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with their roles. One user per team (v1).';
COMMENT ON COLUMN team_members.role IS 'User role within the team: owner (1 per team), admin, member, super_admin.';
COMMENT ON COLUMN team_members.joined_at IS 'When the user joined or was added to the team.';
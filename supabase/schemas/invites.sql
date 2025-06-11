-- Invites table - Simplified tracking for Supabase's built-in invite system
-- This table tracks which invites were sent, relying on Supabase's auth.admin.inviteUserByEmail()
CREATE TABLE invites (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email text NOT NULL,
    invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_invites_team_id ON invites(team_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_invited_by ON invites(invited_by);

-- Comments
COMMENT ON TABLE invites IS 'Tracking table for team invitations sent via Supabase auth.admin.inviteUserByEmail().';
COMMENT ON COLUMN invites.invited_by IS 'User who sent the invitation (admin or owner).';
COMMENT ON COLUMN invites.email IS 'Email address that was invited to join the team.';
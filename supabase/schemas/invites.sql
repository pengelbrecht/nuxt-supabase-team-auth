-- Invites table - Team invitations with secure tokens
CREATE TABLE invites (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    status invite_status NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT invites_expires_at_future CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_invites_team_id ON invites(team_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_token_hash ON invites(token_hash);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);

-- Comments
COMMENT ON TABLE invites IS 'Team invitations sent via email with secure token-based acceptance.';
COMMENT ON COLUMN invites.token_hash IS 'Hashed invitation token for security. Never store plain tokens.';
COMMENT ON COLUMN invites.expires_at IS 'Invitation expiry time (typically 7 days from creation).';
COMMENT ON COLUMN invites.status IS 'Current status of the invitation.';
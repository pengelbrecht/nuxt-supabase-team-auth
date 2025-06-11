-- Impersonation sessions table - Audit log for admin impersonation
CREATE TABLE impersonation_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    reason text NOT NULL,
    
    -- Constraints
    CONSTRAINT impersonation_sessions_different_users CHECK (admin_user_id != target_user_id),
    CONSTRAINT impersonation_sessions_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Indexes
CREATE INDEX idx_impersonation_sessions_admin_user_id ON impersonation_sessions(admin_user_id);
CREATE INDEX idx_impersonation_sessions_target_user_id ON impersonation_sessions(target_user_id);
CREATE INDEX idx_impersonation_sessions_started_at ON impersonation_sessions(started_at);

-- Comments
COMMENT ON TABLE impersonation_sessions IS 'Audit log for super-admin impersonation sessions with 1-year retention.';
COMMENT ON COLUMN impersonation_sessions.reason IS 'Required business justification for impersonation.';
COMMENT ON COLUMN impersonation_sessions.ended_at IS 'When impersonation ended (NULL if still active).';
-- Add expires_at column to existing impersonation_sessions table
ALTER TABLE impersonation_sessions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes');

-- Add comment for the new column
COMMENT ON COLUMN impersonation_sessions.expires_at IS 'When the impersonation session expires automatically';

-- Add index for performance on expires_at
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_expires_at 
ON impersonation_sessions(expires_at);

-- Add created_at and updated_at columns for consistency
ALTER TABLE impersonation_sessions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create or replace the trigger function for updated_at
CREATE OR REPLACE FUNCTION update_impersonation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS impersonation_sessions_updated_at ON impersonation_sessions;
CREATE TRIGGER impersonation_sessions_updated_at
    BEFORE UPDATE ON impersonation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_impersonation_sessions_updated_at();
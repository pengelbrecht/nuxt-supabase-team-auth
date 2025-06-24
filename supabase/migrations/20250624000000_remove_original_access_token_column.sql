-- Remove original_access_token column since we're switching to magic link approach
-- This completes the migration from token storage to JWT cookie + magic link restoration

ALTER TABLE public.impersonation_sessions 
DROP COLUMN IF EXISTS original_access_token;

-- Update table comment to reflect the new approach
COMMENT ON TABLE public.impersonation_sessions IS 'Audit log for super-admin impersonation sessions. Session restoration uses JWT cookies + magic links.';
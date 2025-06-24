-- Remove unused refresh token column since we can't reliably get it server-side
-- The security fix still works - we just don't store access tokens in localStorage

ALTER TABLE public.impersonation_sessions 
DROP COLUMN IF EXISTS original_refresh_token;

-- Update comment on access token column to reflect it's the only token we store
COMMENT ON COLUMN public.impersonation_sessions.original_access_token IS 'Original admin access token for audit trail (refresh token handled client-side)';
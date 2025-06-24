-- Add columns to store original session tokens securely on server-side
-- This fixes the security vulnerability of storing access tokens in localStorage

ALTER TABLE public.impersonation_sessions 
ADD COLUMN original_access_token TEXT,
ADD COLUMN original_refresh_token TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.impersonation_sessions.original_access_token IS 'Encrypted original admin access token for session restoration';
COMMENT ON COLUMN public.impersonation_sessions.original_refresh_token IS 'Encrypted original admin refresh token for session restoration';
-- Add helper function for easy test data cleanup
-- This allows safe deletion of users who are team owners

CREATE OR REPLACE FUNCTION cleanup_test_user(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find the user
    SELECT id, email INTO user_record FROM auth.users WHERE email = user_email;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'User % not found', user_email;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Cleaning up user: %', user_record.email;
    
    -- Use transaction to safely clean up everything
    -- Temporarily disable the constraint
    ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
    
    -- Delete teams owned by this user (cascades to team_members)
    DELETE FROM teams WHERE id IN (
        SELECT tm.team_id FROM team_members tm 
        WHERE tm.user_id = user_record.id AND tm.role = 'owner'
    );
    
    -- Clean up profile
    DELETE FROM profiles WHERE id = user_record.id;
    
    -- Delete from auth
    DELETE FROM auth.users WHERE id = user_record.id;
    
    -- Re-enable the constraint
    ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
    
    RAISE NOTICE 'User % cleaned up successfully', user_record.email;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Always re-enable the trigger in case of error
        ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
        RAISE;
END;
$$;

-- Grant execute to authenticated users (for development)
GRANT EXECUTE ON FUNCTION cleanup_test_user(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION cleanup_test_user(TEXT) IS 
'Helper function for test cleanup. Safely deletes a user and their owned teams by temporarily disabling the owner constraint.';
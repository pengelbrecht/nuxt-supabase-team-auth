-- Add helper function for easy test data cleanup
-- This allows safe deletion of users who are team owners

CREATE OR REPLACE FUNCTION cleanup_test_user(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    team_record RECORD;
BEGIN
    -- Find the user
    SELECT id INTO user_record FROM auth.users WHERE email = user_email;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'User % not found', user_email;
        RETURN;
    END IF;
    
    -- Find teams owned by this user
    FOR team_record IN 
        SELECT DISTINCT t.id, t.name 
        FROM teams t 
        JOIN team_members tm ON t.id = tm.team_id 
        WHERE tm.user_id = user_record.id AND tm.role = 'owner'
    LOOP
        RAISE NOTICE 'Deleting team: %', team_record.name;
        
        -- Temporarily disable the constraint
        ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
        
        -- Delete the team (cascades to team_members)
        DELETE FROM teams WHERE id = team_record.id;
        
        -- Re-enable the constraint
        ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
    END LOOP;
    
    -- Clean up profile
    DELETE FROM profiles WHERE id = user_record.id;
    
    -- Delete from auth
    DELETE FROM auth.users WHERE id = user_record.id;
    
    RAISE NOTICE 'User % cleaned up successfully', user_email;
END;
$$;

-- Grant execute to authenticated users (for development)
GRANT EXECUTE ON FUNCTION cleanup_test_user(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION cleanup_test_user(TEXT) IS 
'Helper function for test cleanup. Safely deletes a user and their owned teams by temporarily disabling the owner constraint.';
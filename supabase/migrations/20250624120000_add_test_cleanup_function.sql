-- Add a test cleanup function that bypasses the owner constraint
-- This function is only for test environments and should be used carefully

CREATE OR REPLACE FUNCTION public.cleanup_test_team(team_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the trigger to allow cleanup
  ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
  
  -- Delete all team members for this team
  DELETE FROM team_members WHERE team_id = team_id_param;
  
  -- Re-enable the trigger
  ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
  
  -- Delete the team itself
  DELETE FROM teams WHERE id = team_id_param;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up test team %', team_id_param;
END;
$$;

-- Grant access to service role
GRANT EXECUTE ON FUNCTION public.cleanup_test_team(uuid) TO service_role;

-- Add a function to cleanup all test users (those with @example.com emails)
CREATE OR REPLACE FUNCTION public.cleanup_all_test_data()
RETURNS TABLE (
  users_deleted integer,
  teams_deleted integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_user_count integer := 0;
  test_team_count integer := 0;
  team_record record;
BEGIN
  -- Temporarily disable the trigger that prevents deleting team owners
  ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner;
  
  -- First, identify and delete all teams that have test users as members
  FOR team_record IN
    SELECT DISTINCT tm.team_id, t.name
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN profiles p ON tm.user_id = p.id
    WHERE p.email LIKE '%@example.com'
  LOOP
    -- Delete all team members for this team
    DELETE FROM team_members WHERE team_id = team_record.team_id;
    
    -- Delete the team
    DELETE FROM teams WHERE id = team_record.team_id;
    
    test_team_count := test_team_count + 1;
    RAISE NOTICE 'Deleted test team: % (%)', team_record.name, team_record.team_id;
  END LOOP;
  
  -- Re-enable the trigger
  ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner;
  
  -- Now delete all test users from auth.users (this will cascade to profiles)
  -- We need to use the auth schema for this
  DELETE FROM auth.users 
  WHERE email LIKE '%@example.com';
  
  -- Get the count of deleted users
  GET DIAGNOSTICS test_user_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % test users and % test teams', test_user_count, test_team_count;
  
  users_deleted := test_user_count;
  teams_deleted := test_team_count;
  RETURN NEXT;
END;
$$;

-- Grant access to service role
GRANT EXECUTE ON FUNCTION public.cleanup_all_test_data() TO service_role;

-- Add a safer function that uses the Supabase auth admin API approach
CREATE OR REPLACE FUNCTION public.get_test_user_ids()
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email 
  FROM profiles p
  WHERE p.email LIKE '%@example.com';
$$;

-- Grant access to service role
GRANT EXECUTE ON FUNCTION public.get_test_user_ids() TO service_role;

-- Comments
COMMENT ON FUNCTION public.cleanup_test_team(uuid) IS 'Cleanup function for test teams that bypasses owner constraints. Use only in test environments.';
COMMENT ON FUNCTION public.cleanup_all_test_data() IS 'Cleanup function for all test data. Use only in test environments.';
COMMENT ON FUNCTION public.get_test_user_ids() IS 'Get all test user IDs for cleanup purposes.';
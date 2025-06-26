-- Add comprehensive team deletion function that can bypass constraints
-- This function temporarily disables the owner constraint trigger to allow proper team cleanup

CREATE OR REPLACE FUNCTION delete_team_comprehensive(team_id_param uuid)
RETURNS TABLE(
  team_deleted boolean,
  members_deleted integer,
  impersonation_sessions_deleted integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  members_count integer := 0;
  impersonation_count integer := 0;
  team_exists boolean := false;
  member_user_ids uuid[];
BEGIN
  -- Security check: Only allow service_role or team owners to delete teams
  IF auth.role() != 'service_role' THEN
    -- Check if current user is an owner of this team
    IF NOT EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = team_id_param 
      AND user_id = auth.uid() 
      AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Only team owners can delete teams';
    END IF;
  END IF;

  -- Check if team exists
  SELECT EXISTS(SELECT 1 FROM teams WHERE id = team_id_param) INTO team_exists;
  IF NOT team_exists THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Get all member user IDs for impersonation cleanup
  SELECT array_agg(user_id) INTO member_user_ids 
  FROM team_members 
  WHERE team_id = team_id_param;

  -- Get count of members to be deleted
  SELECT COUNT(*) INTO members_count 
  FROM team_members 
  WHERE team_id = team_id_param;

  -- Temporarily disable the trigger that prevents deletion of last owner
  BEGIN
    ALTER TABLE team_members DISABLE TRIGGER ensure_team_has_owner_trigger;
  EXCEPTION
    WHEN OTHERS THEN
      -- Trigger may not exist, continue anyway
      NULL;
  END;

  -- Start deletion process within exception block to ensure trigger is re-enabled
  BEGIN
    -- Delete impersonation sessions for team members
    DELETE FROM impersonation_sessions 
    WHERE target_user_id = ANY(member_user_ids);
    
    GET DIAGNOSTICS impersonation_count = ROW_COUNT;

    -- Delete all team members (including owners)
    DELETE FROM team_members WHERE team_id = team_id_param;

    -- Delete the team itself (this should cascade to any remaining related data)
    DELETE FROM teams WHERE id = team_id_param;

    -- Re-enable the trigger
    BEGIN
      ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log warning but don't fail the operation
        RAISE WARNING 'Could not re-enable ensure_team_has_owner_trigger: %', SQLERRM;
    END;

    -- Return success metrics
    RETURN QUERY SELECT true, members_count, impersonation_count;

  EXCEPTION
    WHEN OTHERS THEN
      -- Always re-enable trigger even if deletion fails
      BEGIN
        ALTER TABLE team_members ENABLE TRIGGER ensure_team_has_owner_trigger;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      
      -- Re-raise the original error
      RAISE;
  END;
END;
$$;

-- Grant execute permission to authenticated users and service_role
GRANT EXECUTE ON FUNCTION delete_team_comprehensive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_team_comprehensive(uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION delete_team_comprehensive(uuid) IS 'Comprehensively delete a team, bypassing owner constraints. Only accessible to team owners or service_role.';
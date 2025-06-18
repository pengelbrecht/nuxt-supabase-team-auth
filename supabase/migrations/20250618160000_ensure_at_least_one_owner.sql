-- Ensure every team has at least one owner
-- This prevents teams from accidentally having zero owners

-- Create a constraint function that checks for at least one owner
CREATE OR REPLACE FUNCTION check_team_has_owner() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  -- On UPDATE or DELETE, check if we're removing the last owner
  IF TG_OP = 'UPDATE' THEN
    -- If changing FROM owner role, check if there are other owners
    IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
      -- Count remaining owners for this team (excluding this row)
      IF (
        SELECT COUNT(*) 
        FROM team_members 
        WHERE team_id = NEW.team_id 
        AND role = 'owner' 
        AND user_id != NEW.user_id
      ) = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last owner from team. Teams must have at least one owner.';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- If deleting an owner, check if there are other owners
    IF OLD.role = 'owner' THEN
      -- Count remaining owners for this team (excluding this row)
      IF (
        SELECT COUNT(*) 
        FROM team_members 
        WHERE team_id = OLD.team_id 
        AND role = 'owner' 
        AND user_id != OLD.user_id
      ) = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last owner from team. Teams must have at least one owner.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_team_has_owner ON team_members;
CREATE TRIGGER ensure_team_has_owner
  BEFORE UPDATE OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_has_owner();

-- Add comment explaining the business rule
COMMENT ON FUNCTION check_team_has_owner() IS 
'Ensures teams always have at least one owner. Prevents deletion or role change of the last owner.';
-- Migration: Allow super_admin to replace sole owner
-- Created: 2025-10-22
-- Description: Modifies check_team_has_owner() trigger to allow owner → super_admin
--              transitions even when the owner is the last member with elevated privileges.
--              This recognizes that super_admin is a special role that can manage teams
--              without requiring the "owner" designation.

-- Drop and recreate the trigger function with updated logic
CREATE OR REPLACE FUNCTION "public"."check_team_has_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- On UPDATE or DELETE, check if we're removing the last owner
  IF TG_OP = 'UPDATE' THEN
    -- If changing FROM owner role, check if there are other owners
    IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
      -- Allow owner → super_admin even if sole owner (super_admin trumps owner requirement)
      IF NEW.role = 'super_admin' THEN
        RETURN NEW;
      END IF;

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

COMMENT ON FUNCTION "public"."check_team_has_owner"() IS 'Ensures teams always have at least one owner or super_admin. Prevents deletion or role change of the last owner, except when changing to super_admin.';

-- Allow multiple owners per team by removing the unique constraint
-- This enables more flexible team ownership models where teams can have co-owners

-- Drop the unique index that prevents multiple owners
DROP INDEX IF EXISTS team_members_unique_owner;

-- Add comment explaining the decision
COMMENT ON TABLE team_members IS 'Team membership with roles. Multiple owners per team are allowed for flexible ownership models.';
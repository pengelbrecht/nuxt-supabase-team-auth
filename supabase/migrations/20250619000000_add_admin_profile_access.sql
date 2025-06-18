-- Allow admins/owners to view and edit team member profiles
-- This enables the "Edit User" functionality in team management

-- Allow admins/owners to view team member profiles
CREATE POLICY "profiles_select_team_members" ON "public"."profiles" 
FOR SELECT USING (
  -- User can see profiles of team members if they are admin/owner/super_admin
  EXISTS (
    SELECT 1 FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
    AND tm2.user_id = profiles.id
    AND tm1.role IN ('owner', 'admin', 'super_admin')
  )
);

-- Allow admins/owners to update specific fields for team members
CREATE POLICY "profiles_update_team_members" ON "public"."profiles"
FOR UPDATE USING (
  -- Can update if user is admin/owner/super_admin in same team
  EXISTS (
    SELECT 1 FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
    AND tm2.user_id = profiles.id
    AND tm1.role IN ('owner', 'admin', 'super_admin')
    AND tm1.user_id != profiles.id -- Can't use this policy to edit own profile
  )
);

-- Note: The actual field restrictions will be enforced in the application layer
-- RLS WITH CHECK clauses for column-level security are complex and can cause issues
-- We'll filter allowed fields in the updateTeamMemberProfile function instead
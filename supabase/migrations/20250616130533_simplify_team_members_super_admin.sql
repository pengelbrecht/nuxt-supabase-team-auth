-- Remove the super admin policy that could cause recursion
-- For now, keep team_members simple with just basic user access

DROP POLICY IF EXISTS "super_admins_full_access_team_members" ON public.team_members;

-- We'll add super admin functionality later if needed
-- For now, keep it simple to avoid any recursion issues
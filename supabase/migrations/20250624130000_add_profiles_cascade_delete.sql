-- Add foreign key constraint from profiles to auth.users with CASCADE DELETE
-- This ensures profiles are automatically deleted when auth.users are deleted

ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
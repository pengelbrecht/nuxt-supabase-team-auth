-- Add email field to profiles table and update trigger to copy from auth.users
-- This solves the team members email display issue without duplicating logic

-- Add email field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the handle_new_user function to also copy email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        new.email
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update email when it changes in auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger AS $$
BEGIN
    -- Update email in profiles when it changes in auth.users
    UPDATE public.profiles 
    SET email = NEW.email 
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email updates
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_user_email_change();

-- Backfill email for existing profiles
UPDATE public.profiles 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE public.profiles.id = auth_users.id 
AND public.profiles.email IS NULL;

-- Add company information fields to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_address_line1 TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_address_line2 TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_city TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_state TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_postal_code TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_country TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS company_vat_number TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.teams.company_name IS 'Legal company name for invoicing';
COMMENT ON COLUMN public.teams.company_address_line1 IS 'Primary address line for company headquarters';
COMMENT ON COLUMN public.teams.company_address_line2 IS 'Secondary address line (apartment, suite, etc.)';
COMMENT ON COLUMN public.teams.company_city IS 'City for company address';
COMMENT ON COLUMN public.teams.company_state IS 'State/Province for company address';
COMMENT ON COLUMN public.teams.company_postal_code IS 'Postal/ZIP code for company address';
COMMENT ON COLUMN public.teams.company_country IS 'Country for company address';
COMMENT ON COLUMN public.teams.company_vat_number IS 'VAT/Tax identification number';

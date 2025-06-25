-- Enhance the handle_new_user() trigger to better handle Google OAuth profile data
-- This migration improves avatar URL handling and full name extraction for Google users

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() 
RETURNS "trigger"
LANGUAGE "plpgsql" 
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, email)
    VALUES (
        new.id,
        -- Enhanced name extraction for Google OAuth users
        COALESCE(
            -- Try full_name first (standard)
            new.raw_user_meta_data->>'full_name',
            -- Try name (Google OAuth)
            new.raw_user_meta_data->>'name',
            -- Try combining given_name + family_name (Google OAuth detailed)
            CASE 
                WHEN new.raw_user_meta_data->>'given_name' IS NOT NULL 
                THEN CONCAT(
                    new.raw_user_meta_data->>'given_name', 
                    CASE 
                        WHEN new.raw_user_meta_data->>'family_name' IS NOT NULL 
                        THEN CONCAT(' ', new.raw_user_meta_data->>'family_name')
                        ELSE ''
                    END
                )
                ELSE NULL
            END,
            -- Fallback to email username
            SPLIT_PART(new.email, '@', 1),
            -- Ultimate fallback
            ''
        ),
        -- Enhanced avatar URL handling for Google OAuth
        CASE 
            -- Google OAuth 'picture' field (preferred)
            WHEN new.raw_user_meta_data->>'picture' IS NOT NULL 
            THEN REPLACE(new.raw_user_meta_data->>'picture', '=s96', '=s256')
            -- Standard 'avatar_url' field
            WHEN new.raw_user_meta_data->>'avatar_url' IS NOT NULL 
            THEN REPLACE(new.raw_user_meta_data->>'avatar_url', '=s96', '=s256')
            -- No avatar
            ELSE NULL
        END,
        new.email
    );
    RETURN new;
END;
$$;

-- Comment on the enhanced function
COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Enhanced trigger to create user profiles with better Google OAuth support - handles Google avatar URLs and name extraction';
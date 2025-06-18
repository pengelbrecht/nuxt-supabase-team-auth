-- Sample data for testing team authentication implementation

-- Note: We let the triggers run to automatically create profiles
-- This avoids permission issues with disabling triggers

-- Step 1: Create test auth users
INSERT INTO
auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
  -- Alpha Corporation users
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'super@a.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin","name":"Super Admin"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'owner@a.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alpha Owner","name":"Alpha Owner"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'admin@a.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alpha Admin","name":"Alpha Admin"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'member@a.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alpha Member","name":"Alpha Member"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  -- Beta Industries users
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated',
    'authenticated',
    'owner@b.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Beta Owner","name":"Beta Owner"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-6666-6666-666666666666',
    'authenticated',
    'authenticated',
    'admin@b.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Beta Admin","name":"Beta Admin"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-7777-7777-777777777777',
    'authenticated',
    'authenticated',
    'member@b.test',
    crypt('password123', gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Beta Member","name":"Beta Member"}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
  );

-- Step 2: Add email identities for auth users
INSERT INTO
auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '{"sub":"11111111-1111-1111-1111-111111111111","email":"super@a.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '{"sub":"22222222-2222-2222-2222-222222222222","email":"owner@a.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@a.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', '{"sub":"44444444-4444-4444-4444-444444444444","email":"member@a.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', '{"sub":"55555555-5555-5555-5555-555555555555","email":"owner@b.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', '{"sub":"66666666-6666-6666-6666-666666666666","email":"admin@b.test"}', 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', '{"sub":"77777777-7777-7777-7777-777777777777","email":"member@b.test"}', 'email', current_timestamp, current_timestamp, current_timestamp);

-- Step 3: Create test teams with company info
INSERT INTO teams (id, name, company_name, company_address_line1, company_city, company_state, company_postal_code, company_country)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Alpha Corporation',
    'Alpha Corporation Inc.',
    '123 Alpha Street',
    'San Francisco',
    'CA',
    '94105',
    'United States'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Beta Industries',
    'Beta Industries LLC',
    '456 Beta Avenue',
    'New York',
    'NY',
    '10001',
    'United States'
  );

-- Step 4: Create team memberships
-- Note: Profiles are automatically created by triggers
INSERT INTO team_members (team_id, user_id, role, joined_at)
VALUES
  -- Alpha Corporation members
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'super_admin', current_timestamp),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'owner', current_timestamp),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'admin', current_timestamp),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', current_timestamp),
  -- Beta Industries members
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner', current_timestamp),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'admin', current_timestamp),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'member', current_timestamp);

-- Debug: Show what we created
DO $$
BEGIN
  RAISE NOTICE 'Seeding completed successfully!';
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Alpha Corporation (4 users):';
  RAISE NOTICE '  super@a.test - super_admin';
  RAISE NOTICE '  owner@a.test - owner';
  RAISE NOTICE '  admin@a.test - admin';
  RAISE NOTICE '  member@a.test - member';
  RAISE NOTICE '';
  RAISE NOTICE 'Beta Industries (3 users):';
  RAISE NOTICE '  owner@b.test - owner';
  RAISE NOTICE '  admin@b.test - admin';
  RAISE NOTICE '  member@b.test - member';
  RAISE NOTICE '';
  RAISE NOTICE 'All users have password: password123';
END $$;
-- SIMPLE: Update Test Profiles
-- Run this in Supabase SQL Editor
-- This will update the FIRST 3 users in your system with test data

-- Step 1: See what users you have
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Update the first user (replace with actual ID from Step 1)
-- Copy the ID from Step 1 and paste it below, then run:

-- Example (replace 'YOUR_USER_ID_HERE' with actual ID):
/*
UPDATE public.user_profiles
SET 
  name = 'Sarah Johnson',
  bio = 'I love connecting with fellow believers and exploring faith together. Passionate about community, prayer, and serving others. Always up for a good conversation over coffee!',
  city = 'New York',
  interests = ARRAY['prayer', 'community', 'coffee', 'bible study', 'worship', 'serving', 'fellowship'],
  role = 'disciple',
  profile_complete = TRUE,
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID_HERE'::uuid;
*/

-- OR: Auto-update first 3 users (simpler approach)
-- This finds users and updates them automatically

-- User 1: Sarah Johnson
DO $$
DECLARE
  user_id_1 UUID;
BEGIN
  -- Get first user without a complete profile
  SELECT u.id INTO user_id_1
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  WHERE p.name IS NULL OR p.name = '' OR p.profile_complete = FALSE
  ORDER BY u.created_at DESC
  LIMIT 1;
  
  IF user_id_1 IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id, email, name, bio, city, interests, role, profile_complete, created_at, updated_at
    )
    SELECT 
      u.id,
      COALESCE(u.email, 'sarah.johnson@example.com'),
      'Sarah Johnson',
      'I love connecting with fellow believers and exploring faith together. Passionate about community, prayer, and serving others. Always up for a good conversation over coffee!',
      'New York',
      ARRAY['prayer', 'community', 'coffee', 'bible study', 'worship', 'serving', 'fellowship'],
      'disciple',
      TRUE,
      NOW(),
      NOW()
    FROM auth.users u
    WHERE u.id = user_id_1
    ON CONFLICT (id) DO UPDATE
    SET 
      name = EXCLUDED.name,
      email = COALESCE(EXCLUDED.email, user_profiles.email),
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      interests = EXCLUDED.interests,
      role = EXCLUDED.role,
      profile_complete = EXCLUDED.profile_complete,
      updated_at = NOW();
  END IF;
END $$;

-- User 2: Michael Chen
DO $$
DECLARE
  user_id_2 UUID;
BEGIN
  SELECT u.id INTO user_id_2
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  WHERE (p.name IS NULL OR p.name = '' OR p.profile_complete = FALSE)
    AND u.id NOT IN (SELECT id FROM public.user_profiles WHERE name = 'Sarah Johnson')
  ORDER BY u.created_at DESC
  LIMIT 1;
  
  IF user_id_2 IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id, email, name, bio, city, interests, role, profile_complete, created_at, updated_at
    )
    SELECT 
      u.id,
      COALESCE(u.email, 'michael.chen@example.com'),
      'Michael Chen',
      'Tech professional by day, Bible study leader by night. Love diving deep into Scripture and discussing theology. Always looking to grow in faith and help others do the same.',
      'Los Angeles',
      ARRAY['bible study', 'theology', 'technology', 'leadership', 'mentoring', 'worship'],
      'steward',
      TRUE,
      NOW(),
      NOW()
    FROM auth.users u
    WHERE u.id = user_id_2
    ON CONFLICT (id) DO UPDATE
    SET 
      name = EXCLUDED.name,
      email = COALESCE(EXCLUDED.email, user_profiles.email),
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      interests = EXCLUDED.interests,
      role = EXCLUDED.role,
      profile_complete = EXCLUDED.profile_complete,
      updated_at = NOW();
  END IF;
END $$;

-- User 3: Emily Davis
DO $$
DECLARE
  user_id_3 UUID;
BEGIN
  SELECT u.id INTO user_id_3
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  WHERE (p.name IS NULL OR p.name = '' OR p.profile_complete = FALSE)
    AND u.id NOT IN (SELECT id FROM public.user_profiles WHERE name IN ('Sarah Johnson', 'Michael Chen'))
  ORDER BY u.created_at DESC
  LIMIT 1;
  
  IF user_id_3 IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id, email, name, bio, city, interests, role, profile_complete, created_at, updated_at
    )
    SELECT 
      u.id,
      COALESCE(u.email, 'emily.davis@example.com'),
      'Emily Davis',
      'Worship leader and prayer warrior. Love music, community, and seeing God move in powerful ways. Always ready to pray with and for others.',
      'Chicago',
      ARRAY['worship', 'prayer', 'music', 'community', 'serving', 'fellowship'],
      'disciple',
      TRUE,
      NOW(),
      NOW()
    FROM auth.users u
    WHERE u.id = user_id_3
    ON CONFLICT (id) DO UPDATE
    SET 
      name = EXCLUDED.name,
      email = COALESCE(EXCLUDED.email, user_profiles.email),
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      interests = EXCLUDED.interests,
      role = EXCLUDED.role,
      profile_complete = EXCLUDED.profile_complete,
      updated_at = NOW();
  END IF;
END $$;

-- Verify results
SELECT 
  id, 
  name, 
  email, 
  city, 
  interests, 
  profile_complete
FROM public.user_profiles 
WHERE name IN ('Sarah Johnson', 'Michael Chen', 'Emily Davis')
ORDER BY name;






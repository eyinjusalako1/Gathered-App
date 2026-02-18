-- Update Test User Profiles for Testing People Discovery
-- 
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run this script (it uses service role privileges, so RLS is bypassed)
-- 3. This will update existing users with test profile data
--
-- Note: If you want to update specific users, replace the SELECT queries with specific user IDs

-- First, let's see what users exist:
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Option A: Update specific users by ID (replace USER_ID_1, USER_ID_2, etc. with actual IDs)
-- Uncomment and modify these if you want to target specific users:

/*
-- Test Profile 1: Sarah Johnson (New York)
UPDATE public.user_profiles
SET 
  name = 'Sarah Johnson',
  email = COALESCE(email, 'sarah.johnson@example.com'),
  bio = 'I love connecting with fellow believers and exploring faith together. Passionate about community, prayer, and serving others. Always up for a good conversation over coffee!',
  city = 'New York',
  interests = ARRAY['prayer', 'community', 'coffee', 'bible study', 'worship', 'serving', 'fellowship'],
  role = 'disciple',
  profile_complete = TRUE,
  updated_at = NOW()
WHERE id = 'USER_ID_1'::uuid;

-- Test Profile 2: Michael Chen (Los Angeles)
UPDATE public.user_profiles
SET 
  name = 'Michael Chen',
  email = COALESCE(email, 'michael.chen@example.com'),
  bio = 'Tech professional by day, Bible study leader by night. Love diving deep into Scripture and discussing theology. Always looking to grow in faith and help others do the same.',
  city = 'Los Angeles',
  interests = ARRAY['bible study', 'theology', 'technology', 'leadership', 'mentoring', 'worship'],
  role = 'steward',
  profile_complete = TRUE,
  updated_at = NOW()
WHERE id = 'USER_ID_2'::uuid;

-- Test Profile 3: Emily Davis (Chicago)
UPDATE public.user_profiles
SET 
  name = 'Emily Davis',
  email = COALESCE(email, 'emily.davis@example.com'),
  bio = 'Worship leader and prayer warrior. Love music, community, and seeing God move in powerful ways. Always ready to pray with and for others.',
  city = 'Chicago',
  interests = ARRAY['worship', 'prayer', 'music', 'community', 'serving', 'fellowship'],
  role = 'disciple',
  profile_complete = TRUE,
  updated_at = NOW()
WHERE id = 'USER_ID_3'::uuid;
*/

-- Option B: Auto-update first 3 users (or create profiles if they don't exist)
-- This will find users without complete profiles and update them

-- Test Profile 1: Sarah Johnson (New York)
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
WHERE u.id NOT IN (
  SELECT id FROM public.user_profiles 
  WHERE name IS NOT NULL AND name != '' AND profile_complete = TRUE
)
ORDER BY u.created_at DESC
LIMIT 1
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

-- Test Profile 2: Michael Chen (Los Angeles)
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
WHERE u.id NOT IN (
  SELECT id FROM public.user_profiles 
  WHERE name IS NOT NULL AND name != '' AND profile_complete = TRUE
)
ORDER BY u.created_at DESC
LIMIT 1
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

-- Test Profile 3: Emily Davis (Chicago) - Shares interests with Sarah
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
WHERE u.id NOT IN (
  SELECT id FROM public.user_profiles 
  WHERE name IS NOT NULL AND name != '' AND profile_complete = TRUE
)
ORDER BY u.created_at DESC
LIMIT 1
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

-- Verify the profiles were created/updated:
SELECT 
  id, 
  name, 
  email, 
  city, 
  interests, 
  profile_complete,
  bio
FROM public.user_profiles 
WHERE name IN ('Sarah Johnson', 'Michael Chen', 'Emily Davis')
ORDER BY name;






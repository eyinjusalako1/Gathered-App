-- Create Test User Profiles for Testing People Discovery
-- Run this in your Supabase SQL Editor
-- This will update existing users with test profile data

-- Step 1: First, see what users you have (run this first to see available user IDs):
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Step 2: Update existing users with test profiles
-- This script will update the first 3 users (or create profiles if they don't exist)

-- Test Profile 1: Sarah Johnson (New York) - Shares interests with Emily
INSERT INTO public.user_profiles (
  id, email, name, bio, city, interests, role, profile_complete, created_at, updated_at
)
SELECT 
  id,
  COALESCE(email, 'sarah.johnson@example.com'),
  'Sarah Johnson',
  'I love connecting with fellow believers and exploring faith together. Passionate about community, prayer, and serving others. Always up for a good conversation over coffee!',
  'New York',
  ARRAY['prayer', 'community', 'coffee', 'bible study', 'worship', 'serving', 'fellowship'],
  'disciple',
  TRUE,
  NOW(),
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles WHERE name IS NOT NULL AND name != '')
ORDER BY created_at DESC
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

-- Test Profile 2: Michael Chen (Los Angeles) - Different interests
INSERT INTO public.user_profiles (
  id, email, name, bio, city, interests, role, profile_complete, created_at, updated_at
)
SELECT 
  id,
  COALESCE(email, 'michael.chen@example.com'),
  'Michael Chen',
  'Tech professional by day, Bible study leader by night. Love diving deep into Scripture and discussing theology. Always looking to grow in faith and help others do the same.',
  'Los Angeles',
  ARRAY['bible study', 'theology', 'technology', 'leadership', 'mentoring', 'worship'],
  'steward',
  TRUE,
  NOW(),
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles WHERE name IS NOT NULL AND name != '')
ORDER BY created_at DESC
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
  id,
  COALESCE(email, 'emily.davis@example.com'),
  'Emily Davis',
  'Worship leader and prayer warrior. Love music, community, and seeing God move in powerful ways. Always ready to pray with and for others.',
  'Chicago',
  ARRAY['worship', 'prayer', 'music', 'community', 'serving', 'fellowship'],
  'disciple',
  TRUE,
  NOW(),
  NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles WHERE name IS NOT NULL AND name != '')
ORDER BY created_at DESC
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
-- SELECT id, name, email, city, interests, profile_complete 
-- FROM public.user_profiles 
-- WHERE name IN ('Sarah Johnson', 'Michael Chen', 'Emily Davis')
-- ORDER BY name;

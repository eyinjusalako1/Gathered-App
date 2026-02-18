-- Update Current User's Profile with Test Interests
-- This will give your profile interests that overlap with test profiles
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: Replace 'YOUR_USER_ID' with your actual user ID
-- To find your user ID, run: SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Option 1: Update specific user by ID
-- Replace 'YOUR_USER_ID' with your actual UUID
/*
UPDATE public.user_profiles
SET 
  interests = ARRAY['prayer', 'community', 'worship', 'bible study', 'fellowship', 'serving'],
  city = 'New York',  -- Set to match Sarah or another test profile
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID'::uuid;
*/

-- Option 2: Update the most recent user (likely you)
-- This updates the user who was created most recently
UPDATE public.user_profiles
SET 
  interests = ARRAY['prayer', 'community', 'worship', 'bible study', 'fellowship', 'serving'],
  city = COALESCE(city, 'New York'),  -- Keep existing city or set to New York
  updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Verify the update
SELECT 
  id,
  name,
  email,
  city,
  interests,
  profile_complete
FROM public.user_profiles
WHERE id = (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Expected result:
-- interests should be: ['prayer', 'community', 'worship', 'bible study', 'fellowship', 'serving']
-- 
-- This will create overlaps with:
-- - Sarah Johnson: prayer, community, worship, fellowship, serving (5 shared)
-- - Emily Davis: worship, prayer, community, serving, fellowship (5 shared)
-- - Michael Chen: bible study, worship (2 shared)






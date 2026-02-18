-- Quick verification script - Run this in Supabase SQL Editor
-- This will show you what profiles exist and their data

-- Check all user profiles
SELECT 
  id,
  name,
  email,
  city,
  bio,
  interests,
  profile_complete,
  role,
  created_at
FROM public.user_profiles
ORDER BY created_at DESC
LIMIT 10;

-- Check if test profiles exist
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

-- Count profiles with complete data
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as profiles_with_name,
  COUNT(CASE WHEN city IS NOT NULL THEN 1 END) as profiles_with_city,
  COUNT(CASE WHEN bio IS NOT NULL THEN 1 END) as profiles_with_bio,
  COUNT(CASE WHEN interests IS NOT NULL AND array_length(interests, 1) > 0 THEN 1 END) as profiles_with_interests,
  COUNT(CASE WHEN profile_complete = TRUE THEN 1 END) as complete_profiles
FROM public.user_profiles;






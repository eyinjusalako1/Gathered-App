# Quick Fix: Show Shared Interests

## Problem
You're not seeing "shared interests" or "why suggested" because your current user profile doesn't have interests set.

## Solution

### Step 1: Update Your Profile with Interests

Run this in **Supabase SQL Editor**:

```sql
-- Update your profile with test interests
UPDATE public.user_profiles
SET 
  interests = ARRAY['prayer', 'community', 'worship', 'bible study', 'fellowship', 'serving'],
  city = COALESCE(city, 'New York'),
  updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

### Step 2: Verify It Worked

Check your profile:
```sql
SELECT id, name, email, city, interests 
FROM public.user_profiles
WHERE id = (
  SELECT id FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

### Step 3: Refresh the App

1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Go to `/discover`
3. You should now see:
   - "5 shared interests" for Sarah Johnson and Emily Davis
   - "2 shared interests" for Michael Chen
   - "Suggested because you both like prayer and community" (or similar)

## Expected Results

After updating your interests to: `['prayer', 'community', 'worship', 'bible study', 'fellowship', 'serving']`

**Sarah Johnson** (has: prayer, community, coffee, bible study, worship, serving, fellowship):
- ✅ 5 shared interests
- ✅ "Suggested because you both like prayer and community"

**Emily Davis** (has: worship, prayer, music, community, serving, fellowship):
- ✅ 5 shared interests  
- ✅ "Suggested because you both like worship and prayer"

**Michael Chen** (has: bible study, theology, technology, leadership, mentoring, worship):
- ✅ 2 shared interests
- ✅ "Suggested because you both like bible study and worship"

## Alternative: Update via Profile Page

If you prefer, you can also:
1. Go to `/profile` in the app
2. Edit your profile
3. Add interests: prayer, community, worship, bible study, fellowship, serving
4. Save
5. Refresh `/discover`






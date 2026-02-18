# Setting Up Test User Profiles

This guide will help you create test user profiles with predefined data to test the People Discovery and Connections features.

## Quick Setup (Recommended)

1. **Go to Supabase Dashboard** → SQL Editor
2. **Run the script**: Copy and paste the contents of `scripts/update-test-profiles.sql`
3. **Verify**: The script will show you the created profiles at the end

## Manual Setup (If you want to target specific users)

### Step 1: Find Your User IDs

Run this query in Supabase SQL Editor:

```sql
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;
```

### Step 2: Update Specific Users

Replace `USER_ID_1`, `USER_ID_2`, etc. with actual IDs from Step 1:

```sql
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
```

## Test Profiles Created

### 1. Sarah Johnson
- **City**: New York
- **Interests**: prayer, community, coffee, bible study, worship, serving, fellowship
- **Role**: disciple
- **Bio**: Community-focused believer who loves connecting over coffee

### 2. Michael Chen
- **City**: Los Angeles
- **Interests**: bible study, theology, technology, leadership, mentoring, worship
- **Role**: steward
- **Bio**: Tech professional and Bible study leader

### 3. Emily Davis
- **City**: Chicago
- **Interests**: worship, prayer, music, community, serving, fellowship
- **Role**: disciple
- **Bio**: Worship leader and prayer warrior

## Testing Scenarios

### Shared Interests
- **Sarah** and **Emily** share: prayer, community, worship, serving, fellowship
- When viewing profiles, you should see "5 shared interests"

### Different Cities
- Test city filtering with New York, Los Angeles, and Chicago

### Connection Flow
1. Log in as one test user
2. Go to `/discover`
3. See other test users with full profiles
4. Click on a card to see the full profile modal
5. Send a connection request
6. Check `/more/connections` to see the request

## Verify Profiles

Run this query to see all test profiles:

```sql
SELECT 
  id, 
  name, 
  email, 
  city, 
  interests, 
  profile_complete,
  LEFT(bio, 50) as bio_preview
FROM public.user_profiles 
WHERE name IN ('Sarah Johnson', 'Michael Chen', 'Emily Davis')
ORDER BY name;
```

## Troubleshooting

### If RLS blocks the update:
The SQL Editor in Supabase runs with service role privileges, so RLS should be bypassed. If you still get errors:

1. Check that the `user_profiles` table exists
2. Verify the user IDs are correct (UUID format)
3. Make sure the users exist in `auth.users`

### If profiles don't show up:
1. Check that `profile_complete = TRUE`
2. Verify the user is not the current logged-in user (discovery excludes self)
3. Check that interests array is not empty
4. Ensure city is set (for city filtering)






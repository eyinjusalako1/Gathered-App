# People Discovery v1 Implementation

## Overview
Bumble-inspired people discovery feature that allows users to find and connect with friends based on location and shared interests.

## Files Created/Modified

### Backend

1. **SQL Migration**: `supabase-migrations/create-user-connections.sql`
   - Creates `user_connections` table
   - RLS policies for secure access
   - Indexes for performance

2. **API Routes**:
   - `src/app/api/discover/people/route.ts` - GET endpoint for discovering people with relevance scoring
   - `src/app/api/connections/request/route.ts` - POST endpoint to send connection requests
   - `src/app/api/connections/respond/route.ts` - POST endpoint to accept/reject requests
   - `src/app/api/connections/list/route.ts` - GET endpoint to list all connections

### Frontend

3. **Pages**:
   - `src/app/discover/page.tsx` - Updated to use real API, show Connect button
   - `src/app/(app)/more/connections/page.tsx` - New connections management page
   - `src/app/(app)/more/page.tsx` - Added Connections menu item

## Features

### 1. People Discovery (`/discover`)
- **Relevance Scoring**:
  - Same city: +2 points
  - Overlapping interests: +1 point per match
  - Results sorted by relevance score (descending)
- **Filters**:
  - Search by name, city, or interests
  - Filter by city (chips)
- **Profile Cards**:
  - Name, city, bio preview
  - Up to 5 interest chips
  - "Connect" button
- **Exclusions**:
  - Current user
  - Users with existing connections (pending/accepted)

### 2. Connection System
- **Request Flow**:
  1. User A clicks "Connect" on User B's profile
  2. Connection request created with status 'pending'
  3. User B receives notification (via connections page)
  4. User B can Accept or Reject
  5. If accepted, both users see each other in "Friends" tab

- **Connection States**:
  - `pending` - Request sent, awaiting response
  - `accepted` - Both users are connected (friends)
  - `rejected` - Request was declined

### 3. Connections Management (`/more/connections`)
- **Three Tabs**:
  - **Incoming**: Pending requests sent to you (Accept/Reject buttons)
  - **Sent**: Requests you've sent (Pending status)
  - **Friends**: Accepted connections

- **Features**:
  - View connection details (name, city, bio, interests)
  - Accept/reject incoming requests
  - See connection status

## Database Schema

### `user_connections` Table
```sql
- id: UUID (primary key)
- requester_id: UUID (references auth.users)
- recipient_id: UUID (references auth.users)
- status: TEXT ('pending', 'accepted', 'rejected')
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- UNIQUE(requester_id, recipient_id)
- CHECK (requester_id != recipient_id)
```

### RLS Policies
1. **SELECT**: Users can view connections where they are requester or recipient
2. **INSERT**: Users can create connection requests (as requester, status='pending')
3. **UPDATE**: Recipients can update status to accepted/rejected

## API Endpoints

### GET `/api/discover/people`
- **Auth**: Required
- **Returns**: Array of user profiles with relevance scores
- **Excludes**: Current user, existing connections
- **Sorts**: By relevance score (descending)

### POST `/api/connections/request`
- **Auth**: Required
- **Body**: `{ recipientId: string }`
- **Returns**: Created connection object
- **Validations**:
  - Cannot send to self
  - Cannot send duplicate request
  - Cannot send if already connected

### POST `/api/connections/respond`
- **Auth**: Required
- **Body**: `{ connectionId: string, action: 'accept' | 'reject' }`
- **Returns**: Updated connection object
- **Validations**:
  - Only recipient can respond
  - Only pending requests can be responded to

### GET `/api/connections/list`
- **Auth**: Required
- **Returns**: `{ incoming: [], outgoing: [], accepted: [] }`
- **Includes**: Other user's profile data (name, avatar, city, bio, interests)

## Testing Steps

### 1. Database Setup
```sql
-- Run the migration in Supabase SQL Editor
-- File: supabase-migrations/create-user-connections.sql
```

### 2. Test Connection Flow

**Scenario A: User A sends request to User B**

1. **User A**:
   - Go to `/discover`
   - Find User B in the list
   - Click "Connect" button
   - Should see success toast
   - User B should disappear from discover list

2. **User B**:
   - Go to `/more/connections`
   - Should see User A in "Incoming" tab
   - Click "Accept"
   - Should see success toast
   - User A should move to "Friends" tab

3. **User A**:
   - Go to `/more/connections`
   - Should see User B in "Friends" tab
   - Original request should be in "Sent" tab (or removed if accepted)

**Scenario B: User B rejects request**

1. **User B**:
   - Go to `/more/connections`
   - See User A in "Incoming" tab
   - Click "Reject" (X button)
   - User A should disappear from list

2. **User A**:
   - Go to `/more/connections`
   - User B should not appear in "Friends" tab
   - Can send new request (if desired)

### 3. Test Discovery Features

1. **Relevance Scoring**:
   - Create users with same city → should appear higher
   - Create users with overlapping interests → should score higher
   - Users with both same city + interests → highest scores

2. **Filters**:
   - Search by name → should filter results
   - Search by city → should filter results
   - Search by interest → should filter results
   - Select city chip → should filter to that city

3. **Exclusions**:
   - Current user should not appear
   - Users with pending/accepted connections should not appear
   - After connecting, user should disappear from discover list

## Security Notes

1. **RLS Policies**: All database operations are protected by Row Level Security
2. **Server-Side Validation**: All API routes validate:
   - User authentication
   - User permissions (e.g., only recipient can respond)
   - Business rules (e.g., cannot connect to self)
3. **Service Role Key**: Used for admin operations (reading all profiles)
   - Note: Consider updating RLS to allow public profile reading for discovery
   - Current implementation uses service role to bypass RLS

## Future Enhancements

1. **Mutual Connections**: Show mutual friends count
2. **Connection Notifications**: Push notifications for new requests
3. **Blocking**: Ability to block users
4. **Connection History**: View past rejected connections
5. **Profile Views**: Track who viewed your profile
6. **Advanced Filters**: Filter by role, interests, etc.
7. **Connection Suggestions**: AI-powered suggestions based on activity

## Known Limitations

1. **RLS for Profiles**: Currently uses service role to read all profiles. Consider adding RLS policy to allow public profile reading for discovery.
2. **No Real-Time Updates**: Connection status changes require page refresh
3. **No Notifications**: Users must manually check connections page
4. **No Mutual Connections**: Feature not yet implemented






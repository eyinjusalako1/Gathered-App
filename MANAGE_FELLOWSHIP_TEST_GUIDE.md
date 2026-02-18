# 🧪 Manage Fellowship Testing Guide

## ✅ What Was Built

### Files Created/Modified:
1. **`src/app/(app)/fellowship/[id]/manage/page.tsx`** - Main manage page with access control
2. **`src/app/api/fellowship/[id]/members/route.ts`** - GET members API
3. **`src/app/api/fellowship/[id]/members/actions/route.ts`** - Member actions API (approve/reject/remove/promote/demote)
4. **`src/app/(app)/fellowship/[id]/page.tsx`** - Added "Manage Fellowship" link for admins

## 🎯 Features Implemented

### 1. Access Control
- ✅ Only group admins and stewards can access
- ✅ Non-admin members get redirected with toast message
- ✅ Server-side validation in API routes

### 2. Overview Cards
- ✅ Members count (active members)
- ✅ Upcoming hangouts count (events for this group)
- ✅ Last chat activity (latest message timestamp)

### 3. Member Management
- ✅ **Active Tab**: Shows all active members
  - Name, role badge (Admin/Member)
  - Actions: Promote to admin, Demote to member, Remove
  - Crown icon for admins
- ✅ **Pending Tab**: Shows pending members
  - Approve / Reject buttons
  - Shows request date

### 4. Quick Actions
- ✅ Host Hangout → `/events/create?group_id={id}`
- ✅ Open Chat → `/chat/{id}`
- ✅ View Group → `/fellowship/{id}`

### 5. API Routes
- ✅ `GET /api/fellowship/[id]/members` - Get all members
- ✅ `POST /api/fellowship/[id]/members/actions` - Member actions:
  - `approve` - Approve pending member
  - `reject` - Reject pending member
  - `remove` - Remove active member
  - `promote` - Promote member to admin
  - `demote` - Demote admin to member

## 🧪 Testing Instructions

### Test 1: Access Control (Admin vs Non-Admin)

**As Admin:**
1. Navigate to `/fellowship/[groupId]` where you are an admin
2. Click the Settings icon (⚙️) in the header
3. Should navigate to `/fellowship/[groupId]/manage`
4. Should see the manage page with all features

**As Non-Admin:**
1. Navigate to `/fellowship/[groupId]` where you are NOT an admin
2. Should NOT see the Settings icon
3. Try navigating directly to `/fellowship/[groupId]/manage`
4. Should be redirected to `/fellowship/[groupId]` with error toast

**As Steward:**
1. As a steward, navigate to any group's manage page
2. Should have access even if not admin of that group

### Test 2: Overview Cards

1. Navigate to manage page
2. Check overview cards show:
   - **Members Count**: Number of active members
   - **Upcoming Hangouts**: Number of future events
   - **Last Chat Activity**: Time of last message (or "No activity")

### Test 3: Active Members Tab

1. Click "Active" tab
2. Verify:
   - All active members are listed
   - Admins show crown icon and "admin" badge
   - Members show "member" badge
   - Each member shows: name, email, join date

3. **Test Promote to Admin:**
   - Find a member (not admin)
   - Click the up arrow (↑) button
   - Should show loading state
   - Should show success toast
   - Member should now show crown icon and "admin" badge

4. **Test Demote Admin:**
   - Find an admin (not yourself)
   - Click the down arrow (↓) button
   - Should show loading state
   - Should show success toast
   - Admin should now show "member" badge

5. **Test Remove Member:**
   - Find a member (not yourself)
   - Click the remove (user-minus) button
   - Should show loading state
   - Should show success toast
   - Member should disappear from list

6. **Test Self-Protection:**
   - Try to remove yourself - should fail with error
   - Try to demote yourself - should fail with error
   - (Unless you're a steward)

### Test 4: Pending Members Tab

1. Click "Pending" tab
2. If there are pending members:
   - Should see list of pending members
   - Each shows: name, email, request date

3. **Test Approve:**
   - Click "Approve" button on a pending member
   - Should show loading state
   - Should show success toast
   - Member should move to Active tab

4. **Test Reject:**
   - Click "Reject" button on a pending member
   - Should show loading state
   - Should show success toast
   - Member should disappear (status becomes "rejected")

### Test 5: Quick Actions

1. **Host Hangout:**
   - Click "Host Hangout" button
   - Should navigate to `/events/create?group_id={groupId}`
   - Group should be pre-selected

2. **Open Chat:**
   - Click "Open Chat" button
   - Should navigate to `/chat/{groupId}`
   - Should open group chat

3. **View Group:**
   - Click "View Group" button
   - Should navigate back to `/fellowship/{groupId}`

### Test 6: Edge Cases

1. **Last Admin Protection:**
   - If you're the only admin, try to demote yourself
   - Should fail with "Cannot demote the last admin" error
   - (Unless you're a steward)

2. **Empty States:**
   - If no active members: Should show "No active members"
   - If no pending members: Should show "No pending members"

3. **Error Handling:**
   - Test with invalid group ID
   - Test with network errors
   - Should show appropriate error messages

## 🔍 API Testing (Optional)

### Test API Routes Directly:

**GET Members:**
```bash
curl -X GET "https://your-app.vercel.app/api/fellowship/{groupId}/members" \
  -H "Authorization: Bearer {token}"
```

**Approve Member:**
```bash
curl -X POST "https://your-app.vercel.app/api/fellowship/{groupId}/members/actions" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "membershipId": "{membershipId}"}'
```

**Remove Member:**
```bash
curl -X POST "https://your-app.vercel.app/api/fellowship/{groupId}/members/actions" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"action": "remove", "membershipId": "{membershipId}"}'
```

## ✅ Success Criteria

All features should:
- ✅ Work on desktop and mobile
- ✅ Match navy+gold house style
- ✅ Have proper loading states
- ✅ Show success/error toasts
- ✅ Enforce access control server-side
- ✅ Handle edge cases gracefully
- ✅ Update UI immediately after actions

## 🐛 Known Limitations

- Pending members come from `group_memberships` with `status='pending'`
- If your system uses `join_requests` table, you may need to adapt the pending logic
- Last admin protection only works for non-stewards (stewards can override)

---

**Happy Testing!** 🎉






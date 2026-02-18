# 🧪 Quick Chat Polish Testing Guide

## ✅ Features to Test

### 1. Chat List Page (`/chat`)

**What to check:**
- [ ] Navigate to `/chat` - should show list of your joined groups
- [ ] **Last Message Preview**: Each group should show the last message (or "No messages yet")
- [ ] **Relative Time**: Should show time like "5m ago", "2h ago", "3d ago"
- [ ] **Unread Badges**: If you have unread messages, should see a gold badge with count
- [ ] **Styling**: Compact rows with navy+gold theme, hover effects
- [ ] **Member Count**: Should show on the right side of each row

**Test Unread Badges:**
1. Open browser console (F12)
2. Run: `localStorage.setItem('chat_unread_<groupId>', '3')` (replace `<groupId>` with actual ID)
3. Refresh page - should see badge with "3"
4. Click the group - badge should disappear

### 2. Group Thread Page (`/chat/[groupId]`)

**Message Bubbles:**
- [ ] **Your Messages**: Right-aligned with gold accent (`bg-gold-500/20`)
- [ ] **Others' Messages**: Left-aligned with avatars/initials
- [ ] **Timestamps**: Visible under each message
- [ ] **Message Content**: Properly formatted and readable

**Devotion Shares:**
- [ ] If a message has `type === 'devotion_share'`, should show special card
- [ ] Card shows "📖 Devotion shared" header
- [ ] Shows `passageRef` from metadata if available
- [ ] Shows reflection preview if available
- [ ] "Open Devotions" button works → navigates to `/devotions`

**UX Features:**
- [ ] **Auto-scroll**: Scrolls to bottom on initial load
- [ ] **Auto-scroll after sending**: Scrolls after sending a message
- [ ] **Sticky input bar**: Input stays fixed at bottom (above bottom nav)
- [ ] **Send disabled while posting**: Button shows loading spinner when sending
- [ ] **Empty state**: If no messages, shows "Start the conversation" with CTA

**Test Sending Messages:**
1. Type a message in the input
2. Click send or press Enter
3. Message should appear right-aligned with gold styling
4. Should auto-scroll to show your message
5. Send button should show loading state while posting

### 3. Mobile Responsiveness

- [ ] Test on mobile viewport (or actual device)
- [ ] Chat list is readable and compact
- [ ] Message bubbles are properly sized
- [ ] Input bar is accessible
- [ ] Timestamps are visible
- [ ] Devotion cards are properly sized

## 🎯 Quick Test Scenarios

### Scenario 1: New Group Chat
1. Go to `/chat`
2. Click a group with no messages
3. Should see empty state with "Start the conversation"
4. Send a test message
5. Should appear right-aligned with gold accent
6. Timestamp should appear below

### Scenario 2: Existing Chat
1. Go to `/chat`
2. Click a group with existing messages
3. Should auto-scroll to bottom
4. Other users' messages should be left-aligned with avatars
5. Your messages should be right-aligned with gold accent
6. Send a new message
7. Should auto-scroll after sending

### Scenario 3: Last Message Preview
1. Go to `/chat`
2. Each group should show last message preview
3. Should show relative time (e.g., "5m ago")
4. Send a new message in one group
5. Return to `/chat` list
6. Last message preview should update

## 🐛 Known Issues to Watch For

- Messages not loading
- Auto-scroll not working
- Timestamps not displaying
- Devotion cards not rendering
- Unread badges not clearing
- Last message preview not updating
- Styling inconsistencies
- Mobile layout issues

## 📝 Notes

- If you don't see last messages, it might be because groups have no messages yet
- Unread badges use localStorage as a placeholder until real unread tracking is implemented
- Devotion shares will only show if messages have `type === 'devotion_share'`

---

**Happy Testing!** 🎉






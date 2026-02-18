# Chat Polish v1 - Testing Checklist

## 🎯 Features to Test

### A) `/chat/[groupId]` - Group Thread Page

#### 1. Message Bubbles
- [ ] **My messages**: Right-aligned with gold accent styling
- [ ] **Other messages**: Left-aligned with avatars/initials
- [ ] **Timestamps**: Visible under each message
- [ ] **Message content**: Properly formatted and readable

#### 2. Devotion Shares
- [ ] **Devotion card renders** when `message.type === 'devotion_share'`
- [ ] Shows "📖 Devotion shared" header
- [ ] Displays `passageRef` from metadata if available
- [ ] Shows reflection preview if available
- [ ] "Open Devotions" CTA button works → navigates to `/devotions`

#### 3. UX Features
- [ ] **Auto-scroll**: Scrolls to bottom on initial load
- [ ] **Auto-scroll after sending**: Scrolls after sending a message
- [ ] **Sticky input bar**: Input stays fixed at bottom (above bottom nav)
- [ ] **Send disabled while posting**: Button shows loading spinner
- [ ] **Empty state**: Shows "Start the conversation" with CTA "Share today's devotion"

### B) `/chat` - Chat List Page

#### 1. Last Message Preview
- [ ] Shows last message preview for each group
- [ ] Shows relative time (e.g., "5m ago", "2h ago", "3d ago")
- [ ] Handles devotion shares with special preview text
- [ ] Shows "No messages yet" if no messages exist

#### 2. Unread Badge
- [ ] Unread badge appears when there are unread messages
- [ ] Badge shows count (or "9+" if > 9)
- [ ] Badge clears when viewing a group
- [ ] Uses localStorage for persistence

#### 3. Styling
- [ ] Compact list rows aligned with fellowship cards
- [ ] Navy+gold color scheme consistent
- [ ] Hover effects with gold accent borders
- [ ] Member count displayed on the right
- [ ] Mobile responsive

## 🧪 Test Scenarios

### Scenario 1: New Group Chat
1. Navigate to `/chat`
2. Click on a group with no messages
3. Verify empty state appears
4. Send a test message
5. Verify message appears right-aligned with gold styling
6. Verify timestamp appears below message

### Scenario 2: Existing Chat
1. Navigate to `/chat`
2. Click on a group with existing messages
3. Verify messages load and auto-scroll to bottom
4. Verify other users' messages are left-aligned with avatars
5. Verify your messages are right-aligned with gold accent
6. Send a new message
7. Verify auto-scroll after sending

### Scenario 3: Devotion Share
1. In a group chat, send a devotion share (if feature exists)
2. Verify devotion card renders with special styling
3. Verify passageRef displays if available
4. Verify reflection preview displays if available
5. Click "Open Devotions" button
6. Verify navigation to `/devotions`

### Scenario 4: Last Message Preview
1. Navigate to `/chat`
2. Verify each group shows last message preview
3. Verify relative time displays correctly
4. Verify devotion shares show special preview text
5. Send a new message in one group
6. Return to `/chat` list
7. Verify last message preview updates

### Scenario 5: Unread Badges
1. Navigate to `/chat`
2. Manually set unread count in localStorage: `localStorage.setItem('chat_unread_<groupId>', '3')`
3. Refresh page
4. Verify unread badge appears with count
5. Click on the group
6. Verify badge clears
7. Return to `/chat` list
8. Verify badge is gone

### Scenario 6: Mobile Responsiveness
1. Test on mobile viewport (or actual device)
2. Verify chat list is readable and compact
3. Verify message bubbles are properly sized
4. Verify input bar is accessible
5. Verify timestamps are visible
6. Verify devotion cards are properly sized

## 🐛 Known Issues to Watch For

- [ ] Messages not loading
- [ ] Auto-scroll not working
- [ ] Timestamps not displaying
- [ ] Devotion cards not rendering
- [ ] Unread badges not clearing
- [ ] Last message preview not updating
- [ ] Styling inconsistencies
- [ ] Mobile layout issues

## ✅ Success Criteria

All features should:
- ✅ Work on desktop and mobile
- ✅ Match navy+gold house style
- ✅ Feel modern and polished
- ✅ Have smooth interactions
- ✅ Handle edge cases gracefully

---

**Testing Date**: _______________
**Tester**: _______________
**Notes**: _______________






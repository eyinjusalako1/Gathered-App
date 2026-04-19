// User profile types
export interface UserProfile {
  id: string
  email: string
  name: string
  age?: number
  denomination?: string
  location?: string
  bio?: string
  church_affiliation?: string
  growth_focus?: string
  created_at: string
  updated_at: string
}

// Fellowship group types
export interface FellowshipGroup {
  id: string
  name: string
  description: string
  is_private: boolean
  location?: string
  latitude?: number
  longitude?: number
  created_by: string
  created_at: string
  updated_at: string
  member_count: number
  max_members?: number
  group_type: 'bible_study' | 'prayer_group' | 'fellowship' | 'youth_group' | 'senior_group' | 'mixed'
  meeting_schedule?: string
  meeting_location?: string
  tags: string[]
  is_active: boolean
}

// Group membership types
export interface GroupMembership {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  status: 'active' | 'pending' | 'rejected'
  joined_at: string
  invited_by?: string
}

// Group join request types
export interface JoinRequest {
  id: string
  group_id: string
  user_id: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  reviewed_by?: string
}

// Group chat message types
export interface GroupChatMessage {
  id: string
  group_id: string
  user_id: string
  content: string
  type: 'text' | 'devotion_share'
  metadata?: {
    passageRef?: string
    reflection?: string
    reply_to?: {
      id: string
      content: string
      sender_name: string
    }
    edited_at?: string
  } | null
  edited_at?: string | null
  created_at: string
  user: {
    id: string
    name: string
    avatar_url?: string | null
  }
}

// Event types
export interface Event {
  id: string
  title: string
  description: string
  event_type: 'bible_study' | 'prayer_meeting' | 'fellowship' | 'evangelism' | 'worship' | 'community_service' | 'other'
  location?: string
  latitude?: number
  longitude?: number
  is_virtual: boolean
  virtual_link?: string
  virtual_platform?: 'zoom' | 'teams' | 'google_meet' | 'other'
  start_time: string
  end_time: string
  created_by: string
  created_at: string
  updated_at: string
  rsvp_count: number
  max_attendees?: number
  is_recurring: boolean
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  recurrence_end_date?: string
  group_id?: string
  is_active: boolean
  tags: string[]
  requires_rsvp: boolean
  allow_guests: boolean
}

// Event RSVP types
export interface EventRSVP {
  id: string
  event_id: string
  user_id: string
  status: 'going' | 'maybe' | 'not_going'
  rsvp_date: string
  guest_count?: number
  notes?: string
}

// Event attendance types
export interface EventAttendance {
  id: string
  event_id: string
  user_id: string
  attended: boolean
  check_in_time?: string
  check_out_time?: string
  notes?: string
}

// Post types
export interface Post {
  id: string
  content: string
  post_type: 'testimony' | 'scripture' | 'encouragement' | 'prayer_request' | 'general'
  author_id: string
  created_at: string
  updated_at: string
  likes_count: number
  comments_count: number
  shares_count: number
  is_pinned: boolean
  is_featured: boolean
  tags: string[]
  group_id?: string
  event_id?: string
  is_active: boolean
  scripture_reference?: string
  prayer_category?: 'healing' | 'guidance' | 'family' | 'work' | 'ministry' | 'other'
}

// Post comment types
export interface PostComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  likes_count: number
  parent_id?: string
  is_active: boolean
}

// Post like types
export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

// Post share types
export interface PostShare {
  id: string
  post_id: string
  user_id: string
  created_at: string
  message?: string
}

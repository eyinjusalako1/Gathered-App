import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const PROFILE_CACHE_KEY = 'gathered_user_profile'
const DISMISS_PREFIX = 'type:'

// Role type for type safety
export type Role = 'disciple' | 'steward'

// Define UserProfile type directly (without Database type dependency)
export type UserProfile = {
  id: string
  email?: string | null
  name?: string | null
  avatar_url?: string | null
  cover_image_url?: string | null
  bio?: string | null
  city?: string | null
  role?: Role | string | null
  interests?: string[] | null
  availability?: string[] | null
  notif_cadence?: string | null
  notif_channel?: string | null
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  dismissed_suggestions?: string[] | null
  last_seen_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  preferred_fellowship_id?: string | null
  my_church_id?: string | null
  last_activity_at?: string | null
  accessibility?: {
    reduceMotion?: boolean
    largeText?: boolean
    highContrast?: boolean
  } | null
  personalization_enabled?: {
    interests?: boolean
    location?: boolean
    suggestions?: boolean
  } | null
  profile_complete?: boolean | null
  growth_focus?: string | null
  growth_intent?: string | null
  reflection_preference?: string | null
  engagement_frequency?: string | null
  life_stage?: string | null
  church_background?: string | null
  gathering_intentions?: string[] | null
  onboarding_completed?: boolean | null
  onboarding_version?: number | null
  discoverable?: boolean | null
}

export type UserProfileUpdate = Partial<Omit<UserProfile, 'id'>> & { id?: never } & Record<string, any>

export type SuggestionType =
  | 'join_fellowship'
  | 'meet_members'
  | 'event_nearby'
  | 'start_prayer_circle'
  | 'weekly_challenge'

export interface Suggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  actionUrl?: string
  score?: number
}

export interface FeedRankingItem {
  id: string
  type: string
  createdAt?: string | number | Date | null
  fellowshipId?: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function safeGetLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (error) {
    console.warn('[prefs] failed to read localStorage', error)
    return null
  }
}

function safeSetLocalStorage<T>(key: string, value: T | null) {
  if (typeof window === 'undefined') return
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.warn('[prefs] failed to write localStorage', error)
  }
}

export function cacheProfile(profile: UserProfile) {
  safeSetLocalStorage(PROFILE_CACHE_KEY, profile)
}

export function getCachedProfile(): UserProfile | null {
  return safeGetLocalStorage<UserProfile>(PROFILE_CACHE_KEY)
}

export function clearProfileCache() {
  safeSetLocalStorage(PROFILE_CACHE_KEY, null)
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('[prefs] failed to load profile', error.message)
      return getCachedProfile()
    }

    if (data) {
      const profile = { ...data, last_activity_at: data.last_seen_at ?? null }
      return profile
    }

    return getCachedProfile()
  }

  return getCachedProfile()
}

export async function upsertUserProfile(userId: string, payload: UserProfileUpdate): Promise<UserProfile | null> {
  const nextPayload = {
    ...payload,
    id: userId,
    updated_at: nowIso(),
  }

  if (isSupabaseConfigured()) {
    // Use RPC function if available, otherwise fall back to direct update/insert
    try {
      // Try using the database function first (if it exists)
      const { data: functionData, error: functionError } = await supabase.rpc('update_user_profile_avatar', {
        p_user_id: userId,
        p_avatar_url: nextPayload.avatar_url || null
      })

      if (!functionError && nextPayload.avatar_url) {
        // Function worked, now get the full profile
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (!error && data) {
          const profile = { ...data, last_activity_at: data.last_seen_at ?? null }
          cacheProfile(profile)
          return profile
        }
      }
    } catch (rpcError) {
      // Function doesn't exist or failed, continue with regular method
      console.log('[prefs] RPC function not available, using direct method')
    }

    // Fallback: Try update first, then insert if it doesn't exist
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    let data, error
    if (existing) {
      // Profile exists, update it
      const result = await supabase
        .from('user_profiles')
        .update(nextPayload)
        .eq('id', userId)
        .select('*')
        .single()
      data = result.data
      error = result.error
    } else {
      // Profile doesn't exist, insert it
      const result = await supabase
        .from('user_profiles')
        .insert(nextPayload)
        .select('*')
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.warn('[prefs] failed to upsert profile', error.message, { userId, payload, error })
      // Provide more helpful error message for RLS policy errors
      if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.message?.includes('violates row-level security')) {
        throw new Error('Profile update blocked by security policy. The RLS policies may need to be reconfigured. Please check that policies allow users to update their own profiles with auth.uid() = id.')
      }
      throw error
    }

    const profile = { ...data, last_activity_at: data.last_seen_at ?? null }
    cacheProfile(profile)
    return profile
  }

  const cached = getCachedProfile() ?? ({ id: userId } as UserProfile)
  const merged = {
    ...cached,
    ...payload,
    id: userId,
    updated_at: nowIso(),
  }

  cacheProfile(merged)
  return merged
}

function isTypeDismissed(profile: UserProfile | null | undefined, type: SuggestionType): boolean {
  if (!profile?.dismissed_suggestions) return false
  return profile.dismissed_suggestions.includes(`${DISMISS_PREFIX}${type}`)
}

function computeSuggestionScore(type: SuggestionType, profile: UserProfile): number {
  let score = 1

  switch (type) {
    case 'join_fellowship':
      score += (profile.interests?.length ?? 0) > 0 ? 2 : 0
      break
    case 'event_nearby':
      if (profile.city) score += 2
      if (profile.availability?.length) score += 1
      break
    case 'start_prayer_circle':
      if (profile.role === 'steward') score += 2
      break
    case 'meet_members':
      score += Math.min(3, profile.interests?.length ?? 0)
      break
    case 'weekly_challenge':
      if (profile.role === 'steward') score += 1
      if (profile.notif_cadence === 'daily') score += 1
      break
    default:
      break
  }

  if (isTypeDismissed(profile, type)) score -= 5

  return score
}

export function buildSuggestions(profile: UserProfile): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (!isTypeDismissed(profile, 'join_fellowship')) {
    suggestions.push({
      id: 'join-fellowship',
      type: 'join_fellowship',
      title: 'Discover a new fellowship',
      description: 'Explore gatherings that match your interests and availability this month.',
      actionUrl: '/fellowships',
    })
  }

  if (!isTypeDismissed(profile, 'event_nearby') && (profile.city || profile.availability?.length)) {
    suggestions.push({
      id: 'event-nearby',
      type: 'event_nearby',
      title: "There's an event near you",
      description: profile.city
        ? `Members in ${profile.city} are planning a meetup. See if the timing works for you.`
        : 'We found gatherings that align with your availability. Take a look and RSVP.',
      actionUrl: '/events',
    })
  }

  if (!isTypeDismissed(profile, 'start_prayer_circle') && profile.role === 'steward') {
    suggestions.push({
      id: 'start-prayer-circle',
      type: 'start_prayer_circle',
      title: 'Start a midweek prayer circle',
      description: "Invite members to share prayers during your usual free time. We'll help with reminders.",
      actionUrl: '/prayers/create',
    })
  }

  if (!isTypeDismissed(profile, 'meet_members') && (profile.interests?.length ?? 0) >= 2) {
    suggestions.push({
      id: 'meet-members',
      type: 'meet_members',
      title: 'Meet someone who shares your interests',
      description: 'We noticed others who love the same activities. Reach out and say hello.',
      actionUrl: '/members',
    })
  }

  if (!isTypeDismissed(profile, 'weekly_challenge')) {
    suggestions.push({
      id: 'weekly-challenge',
      type: 'weekly_challenge',
      title: "Join this week's challenge",
      description: 'Keep your flame alive by completing the Weekly Challenge together.',
      actionUrl: '/challenges',
    })
  }

  const dismissedIds = new Set(profile.dismissed_suggestions ?? [])
  return suggestions
    .filter((suggestion) => !dismissedIds.has(suggestion.id))
    .map((suggestion) => ({
      ...suggestion,
      score: computeSuggestionScore(suggestion.type, profile),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

export function rankFeed<T extends FeedRankingItem>(items: T[], profile?: UserProfile | null): T[] {
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }

  const interests = (profile?.interests ?? []).map((interest) => interest.toLowerCase())
  const mutedTypes = new Set(
    (profile?.dismissed_suggestions ?? [])
      .filter((value) => value.startsWith(DISMISS_PREFIX))
      .map((value) => value.replace(DISMISS_PREFIX, ''))
  )
  const primaryFellowship = profile?.preferred_fellowship_id ?? null

  const scored = items.map((item) => {
    let score = 0

    const itemType = item.type.toLowerCase()
    if (interests.includes(itemType)) {
      score += 2
    }

    if (primaryFellowship && item.fellowshipId && item.fellowshipId === primaryFellowship) {
      score += 1
    }

    if (mutedTypes.has(itemType)) {
      score -= 1
    }

    if (item.createdAt) {
      const created = new Date(item.createdAt)
      const hoursOld = (Date.now() - created.getTime()) / (1000 * 60 * 60)
      const recencyBoost = Math.max(0, 12 - hoursOld) / 12
      score += recencyBoost
    }

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.item)
}

/**
 * Check if a user profile has the steward role
 * @param profile - User profile to check (can be null/undefined)
 * @returns true if the user is a steward, false otherwise
 */
export function isSteward(profile?: UserProfile | null): boolean {
  if (!profile?.role) return false
  const role = typeof profile.role === 'string' ? profile.role.toLowerCase() : profile.role
  return role === 'steward'
}

/**
 * Check if a user profile has the disciple role
 * @param profile - User profile to check (can be null/undefined)
 * @returns true if the user is a disciple, false otherwise
 */
export function isDisciple(profile?: UserProfile | null): boolean {
  if (!profile?.role) return false
  const role = typeof profile.role === 'string' ? profile.role.toLowerCase() : profile.role
  return role === 'disciple'
}

/**
 * Normalize role string to Role type
 * @param role - Role string (case-insensitive)
 * @returns Normalized Role or null if invalid
 */
export function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null
  const normalized = role.toLowerCase()
  if (normalized === 'disciple' || normalized === 'steward') {
    return normalized as Role
  }
  return null
}
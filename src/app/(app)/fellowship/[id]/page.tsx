'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { EventService } from '@/lib/event-service'
import { supabase } from '@/lib/supabase'
import { FellowshipGroup, GroupMembership, Event } from '@/types'
import { getGradientFromName } from '@/utils/gradient'
import { ActivityPlannerRequest, ActivityPlannerAPIResponse, ActivityPlannerResponse } from '@/types/activity-planner'

// Extended suggestion type with category
type SuggestionWithCategory = ActivityPlannerResponse & {
  category: 'chill' | 'activity' | 'service'
}
import { 
  Users, 
  MapPin, 
  Calendar, 
  Lock, 
  Globe, 
  MessageCircle,
  Settings,
  UserPlus,
  LogOut,
  ArrowRight,
  Clock,
  Plus,
  Share2
} from 'lucide-react'
import MemberInviteModal from '@/components/MemberInviteModal'

export default function FellowshipDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { isSteward } = useUserProfile()
  const toast = useToast()
  const [group, setGroup] = useState<FellowshipGroup | null>(null)
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string>('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [groupId, setGroupId] = useState<string>('')
  const [suggestions, setSuggestions] = useState<SuggestionWithCategory[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // Resolve params (handle both Promise and direct params for Next.js 14/15 compatibility)
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolvedParams = params instanceof Promise ? await params : params
        const id = resolvedParams?.id || ''
        setGroupId(id)
      } catch (error) {
        console.error('Error resolving params:', error)
      }
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (groupId) {
      loadGroupData()
      loadUpcomingEvents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user])

  // Load suggestions when there are no events
  useEffect(() => {
    if (!eventsLoading && upcomingEvents.length === 0 && group) {
      generateSuggestions()
    } else {
      setSuggestions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsLoading, upcomingEvents.length, group])

  const loadGroupData = async () => {
    if (!groupId) return
    try {
      setLoading(true)
      const groupData = await FellowshipService.getGroup(groupId)
      let membershipsData: GroupMembership[] = []
      
      if (groupData) {
        try {
          membershipsData = await FellowshipService.getGroupMembers(groupId)
        } catch (error) {
          console.error('Error loading members:', error)
        }
      }

      setGroup(groupData)
      setMemberships(membershipsData || [])

      // Check membership status directly using dedicated method
      if (user) {
        try {
          const userMembership = await FellowshipService.getUserMembershipForGroup(user.id, groupId)
          setIsMember(!!userMembership)
          setIsAdmin(userMembership?.role === 'admin')
        } catch (error) {
          console.error('Error checking membership:', error)
          // Fallback to checking memberships list
          const userMembership = membershipsData?.find(m => m.user_id === user.id)
          setIsMember(!!userMembership)
          setIsAdmin(userMembership?.role === 'admin')
        }
      } else {
        setIsMember(false)
        setIsAdmin(false)
      }
    } catch (error: any) {
      console.error('Error loading group:', error)
      // Don't show toast if it's likely an RLS/permission issue (user might have just joined)
      // Only show error if it's a real problem
      if (error.code !== 'PGRST301' && error.message?.includes('JWT')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load group. Please try refreshing the page.',
          variant: 'error',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const loadUpcomingEvents = async () => {
    if (!groupId) return
    try {
      setEventsLoading(true)
      // TODO: Filter events by group_id when group_id linkage is fully implemented
      // For now, try to fetch events for this group
      const events = await EventService.getEvents(user?.id, groupId)
      const now = new Date().toISOString()
      const upcoming = events
        .filter(event => event.start_time >= now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5)
      setUpcomingEvents(upcoming)
    } catch (error) {
      console.error('Error loading upcoming events:', error)
      // Graceful fallback - show empty state
      setUpcomingEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const generateSuggestions = async () => {
    if (!group) return
    
    try {
      setSuggestionsLoading(true)
      
      // Build description from group context
      const groupContext = [
        group.name,
        group.description || '',
        group.location ? `in ${group.location}` : '',
        group.meeting_schedule ? `meeting ${group.meeting_schedule}` : ''
      ].filter(Boolean).join(', ')

      // Generate 3 different hangout ideas with explicit categories
      // Make descriptions more distinct to avoid duplicates
      const suggestionConfigs = [
        {
          category: 'chill' as const,
          description: `A casual coffee and conversation hangout for ${group.name}. ${groupContext}. Focus on relaxed social connection, maybe board games or just chatting. Keep it low-key and comfortable.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Friday evening or weekend',
          comfort_level: 'small group'
        },
        {
          category: 'activity' as const,
          description: `An active event for ${group.name}. ${groupContext}. Think sports, games, outdoor activities, or creative workshops. Something hands-on and engaging where people can participate actively.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Saturday afternoon',
          comfort_level: 'medium group'
        },
        {
          category: 'service' as const,
          description: `A community service or volunteer opportunity for ${group.name}. ${groupContext}. Focus on giving back, helping others, or serving the community together. Make it meaningful and impactful.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Sunday afternoon',
          comfort_level: 'small group'
        }
      ]

      const suggestionPromises = suggestionConfigs.map(config =>
        fetch('/api/agents/ActivityPlanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: config.description,
            location_hint: config.location_hint,
            time_hint: config.time_hint,
            comfort_level: config.comfort_level
          } as ActivityPlannerRequest)
        })
      )

      const responses = await Promise.all(suggestionPromises)
      const results = await Promise.all(
        responses.map(async (res, index) => {
          if (!res.ok) return null
          const data: ActivityPlannerAPIResponse = await res.json()
          // Assign category explicitly based on index
          return {
            ...data.data,
            category: suggestionConfigs[index].category
          } as SuggestionWithCategory
        })
      )

      // Filter out nulls
      let validSuggestions = results.filter((s): s is SuggestionWithCategory => s !== null)
      
      // Deduplicate suggestions by title (case-insensitive, normalized)
      const seenTitles = new Set<string>()
      const uniqueSuggestions: SuggestionWithCategory[] = []
      
      for (const suggestion of validSuggestions) {
        // Normalize title: lowercase, trim, remove extra spaces
        const normalizedTitle = suggestion.suggested_title
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')
        
        // Check if we've seen a similar title (exact match or very similar)
        let isDuplicate = false
        const seenTitlesArray = Array.from(seenTitles)
        for (let i = 0; i < seenTitlesArray.length; i++) {
          const seenTitle = seenTitlesArray[i]
          // Check for exact match or very similar (e.g., "Games Night" vs "Game Night")
          if (normalizedTitle === seenTitle || 
              normalizedTitle.includes(seenTitle) || 
              seenTitle.includes(normalizedTitle)) {
            isDuplicate = true
            break
          }
        }
        
        if (!isDuplicate) {
          seenTitles.add(normalizedTitle)
          uniqueSuggestions.push(suggestion)
        }
      }
      
      // Ensure we have at least one suggestion per category if possible
      // If we lost suggestions due to duplicates, try to keep category diversity
      const categoryMap = new Map<'chill' | 'activity' | 'service', SuggestionWithCategory>()
      for (const suggestion of uniqueSuggestions) {
        if (!categoryMap.has(suggestion.category)) {
          categoryMap.set(suggestion.category, suggestion)
        }
      }
      
      // Prioritize suggestions that maintain category diversity
      const finalSuggestions = uniqueSuggestions.length >= 3
        ? uniqueSuggestions.slice(0, 3)
        : Array.from(categoryMap.values()).slice(0, 3)
      
      setSuggestions(finalSuggestions)
    } catch (error) {
      console.error('Error generating suggestions:', error)
      // Fallback: create simple mock suggestions with categories
      setSuggestions([
        {
          suggested_title: 'Casual Hangout',
          suggested_description: `A relaxed gathering for ${group.name} members to connect and chat.`,
          suggested_group_size: 6,
          suggested_tags: ['casual', 'social', 'hangout'],
          suggested_location_hint: group.location || 'local venue',
          suggested_time_hint: group.meeting_schedule || 'Friday evening',
          category: 'chill' as const
        },
        {
          suggested_title: 'Activity Night',
          suggested_description: `A fun activity for ${group.name} to enjoy together.`,
          suggested_group_size: 8,
          suggested_tags: ['activity', 'fun', 'social'],
          suggested_location_hint: group.location || 'local venue',
          suggested_time_hint: group.meeting_schedule || 'Saturday afternoon',
          category: 'activity' as const
        },
        {
          suggested_title: 'Community Service',
          suggested_description: `A meaningful gathering for ${group.name} to serve and connect.`,
          suggested_group_size: 6,
          suggested_tags: ['service', 'community', 'meaningful'],
          suggested_location_hint: group.location || 'local venue',
          suggested_time_hint: group.meeting_schedule || 'Sunday afternoon',
          category: 'service' as const
        }
      ])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const handleHostSuggestion = (suggestion: SuggestionWithCategory) => {
    // Build query params for event creation with prefill
    const params = new URLSearchParams({
      group_id: groupId,
      title: suggestion.suggested_title,
      description: suggestion.suggested_description,
      tags: suggestion.suggested_tags.join(','),
      location_hint: suggestion.suggested_location_hint,
      time_hint: suggestion.suggested_time_hint
    })
    router.push(`/events/create?${params.toString()}`)
  }

  const handleCreateInvite = async () => {
    if (!user || !group || !isMember) return

    setCreatingInvite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please log in to create invites')
      }

      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          invite_type: 'group',
          group_id: groupId,
        }),
      })

      if (response.status === 403) {
        toast({
          title: 'You need to join this group before inviting others.',
          variant: 'error',
        })
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create invite')
      }

      const data = await response.json()
      const url = data?.inviteUrl || data?.invite?.invite_url
      if (!url) {
        throw new Error('Invite link was not returned. Please try again.')
      }
      setInviteUrl(url)
      setShowInviteModal(true)
    } catch (error: any) {
      console.error('Error creating invite:', error)
      toast({
        title: 'Failed to create invite',
        description: error.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleJoin = async () => {
    if (!user || !group) return

    setJoining(true)
    try {
      if (group.is_private) {
        await FellowshipService.requestToJoinGroup(groupId, user.id)
        toast({
          title: 'Join request sent',
          description: 'Your request to join this group has been sent to the group admin',
          variant: 'success',
        })
      } else {
        await FellowshipService.joinGroup(groupId, user.id)
        toast({
          title: 'Joined group',
          description: 'You have successfully joined this fellowship group',
          variant: 'success',
        })
        // Immediately check membership status
        try {
          const userMembership = await FellowshipService.getUserMembershipForGroup(user.id, groupId)
          setIsMember(!!userMembership)
          setIsAdmin(userMembership?.role === 'admin')
          // Refresh group data to update member count
          await loadGroupData()
        } catch (membershipError) {
          // If membership check fails, still reload all data
          await loadGroupData()
        }
      }
    } catch (error: any) {
      console.error('Error joining group:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to join group',
        variant: 'error',
      })
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    if (!user || !group) return

    setLeaving(true)
    try {
      await FellowshipService.leaveGroup(groupId, user.id)
      toast({
        title: 'Left group',
        description: 'You have left this fellowship group',
        variant: 'success',
      })
      setShowLeaveConfirm(false)
      // Update state immediately
      setIsMember(false)
      setIsAdmin(false)
      // Redirect to groups list after leaving
      router.push('/fellowship')
    } catch (error: any) {
      console.error('Error leaving group:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave group',
        variant: 'error',
      })
    } finally {
      setLeaving(false)
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    }
  }

  const getUserInitial = (membership: GroupMembership): string => {
    const userData = (membership as any).user
    const name = userData?.user_metadata?.name || userData?.email || 'U'
    return String(name).charAt(0).toUpperCase()
  }

  const getUserName = (membership: GroupMembership): string => {
    const userData = (membership as any).user
    return userData?.user_metadata?.name || userData?.email || 'Unknown User'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-slate-300">Loading group...</p>
        </div>
      </main>
    )
  }

  if (!group) {
    return (
      <main className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50 mb-4">Group Not Found</h1>
          <p className="text-slate-400 mb-6">The group you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <button 
            onClick={() => router.push('/fellowship')} 
            className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            Back to Groups
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50">
      {/* Hero Header with Gradient Cover */}
      <div className="relative">
        <div
          className="h-48 w-full"
          style={{ background: getGradientFromName(group.name) }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/80 to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <button
            onClick={() => router.push('/fellowship')}
            className="mb-4 text-sm text-slate-300 hover:text-gold-500 transition-colors inline-flex items-center gap-1"
          >
            ← Back to groups
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-50">{group.name}</h1>
                {group.is_private ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/60 border border-white/20 rounded-full text-xs text-slate-300">
                    <Lock className="w-3 h-3" />
                    <span>Private</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/60 border border-white/20 rounded-full text-xs text-slate-300">
                    <Globe className="w-3 h-3" />
                    <span>Public</span>
                  </span>
                )}
                {isMember && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gold-500/20 border border-gold-500/40 rounded-full text-xs text-gold-500">
                    <span>Member</span>
                  </span>
                )}
              </div>
              
              <p className="text-slate-200 text-lg mb-4">{group.description}</p>

              {/* Info Chips */}
              <div className="flex flex-wrap items-center gap-3">
                {group.location && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                    <MapPin className="w-4 h-4" />
                    <span>{group.location}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                  <Users className="w-4 h-4" />
                  <span>{group.member_count || 0} {group.member_count === 1 ? 'member' : 'members'}</span>
                </div>
                {group.meeting_schedule && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                    <Calendar className="w-4 h-4" />
                    <span>{group.meeting_schedule}</span>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => router.push(`/fellowship/${group.id}/manage`)}
                className="p-2 text-slate-300 hover:text-gold-500 transition-colors"
                title="Manage Fellowship"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isMember ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900"></div>
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>{group.is_private ? 'Request to Join' : 'Join Group'}</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Leave Group</span>
              </button>
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-600/40 text-gold-500 px-6 py-3 text-sm font-medium hover:bg-gold-500/10 transition-colors disabled:opacity-50"
              >
                {creatingInvite ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gold-500"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5" />
                    <span>Invite to Group</span>
                  </>
                )}
              </button>
              <button
                onClick={() => router.push(`/chat/${groupId}`)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-600/40 text-gold-500 px-6 py-3 text-sm font-medium hover:bg-gold-500/10 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Go to Chats</span>
              </button>
            </>
          )}
        </div>

        {/* Invite Modal */}
        <MemberInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          fellowshipName={group?.name || 'this group'}
          fellowshipId={groupId}
          inviteUrl={inviteUrl}
          onCreateInvite={handleCreateInvite}
          creatingInvite={creatingInvite}
        />

        {/* Leave Confirmation Modal */}
        {showLeaveConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-50 mb-2">Leave Group?</h3>
              <p className="text-sm text-slate-300 mb-6">
                You&apos;ll stop receiving updates and won&apos;t be able to access group chats. You can rejoin anytime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 rounded-xl border border-white/20 text-slate-300 px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="flex-1 rounded-xl bg-red-500 text-white px-4 py-2 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {leaving ? 'Leaving...' : 'Leave Group'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* What's Happening */}
        <div className="space-y-6">
          {/* Upcoming Hangouts */}
          <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-50">Upcoming hangouts</h2>
              {isMember && isSteward && (
                <button
                  onClick={() => router.push(`/events/create?group_id=${groupId}`)}
                  className="text-xs text-gold-500 hover:text-gold-600 transition-colors"
                >
                  Host hangout →
                </button>
              )}
            </div>

            {eventsLoading ? (
              <p className="text-sm text-slate-400">Loading events...</p>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const { date, time } = formatEventDate(event.start_time)
                  return (
                    <button
                      key={event.id}
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="w-full text-left p-4 bg-navy-900/60 border border-white/10 rounded-xl hover:border-gold-500/40 hover:shadow-[0_0_10px_rgba(245,196,81,0.15)] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-200 truncate mb-1">
                            {event.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{date}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{time}</span>
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{event.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Users className="w-4 h-4" />
                          <span>{event.rsvp_count}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 mb-1">
                    No hangouts scheduled yet
                  </p>
                  <p className="text-xs text-slate-400">
                    {isMember && isSteward
                      ? 'Host the first hangout for this group'
                      : 'Stewards can host the first one'}
                  </p>
                </div>

                {/* Suggested Hangouts */}
                {suggestionsLoading ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-400">Generating ideas...</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3">Suggested hangouts</h3>
                    {suggestions.map((suggestion, index) => {
                      // Get badge styles based on category
                      const getBadgeStyles = (category: 'chill' | 'activity' | 'service') => {
                        switch (category) {
                          case 'chill':
                            return 'bg-gold-500/15 text-gold-500 border-gold-600/30'
                          case 'activity':
                            return 'bg-purple-500/15 text-purple-300 border-purple-400/30'
                          case 'service':
                            return 'bg-blue-500/15 text-blue-300 border-blue-400/30'
                          default:
                            return 'bg-gold-500/15 text-gold-500 border-gold-600/30'
                        }
                      }

                      const getBadgeLabel = (category: 'chill' | 'activity' | 'service') => {
                        switch (category) {
                          case 'chill':
                            return 'Chill'
                          case 'activity':
                            return 'Activity'
                          case 'service':
                            return 'Service'
                          default:
                            return 'Chill'
                        }
                      }

                      return (
                        <div
                          key={index}
                          className="p-4 bg-navy-900/60 border border-white/10 rounded-xl hover:border-gold-500/30 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border ${getBadgeStyles(suggestion.category)}`}
                                >
                                  {getBadgeLabel(suggestion.category)}
                                </span>
                                <h4 className="text-sm font-semibold text-slate-200">
                                  {suggestion.suggested_title}
                                </h4>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">
                                {suggestion.suggested_description}
                              </p>
                            </div>
                          </div>
                        
                        {/* Tags */}
                        {suggestion.suggested_tags && suggestion.suggested_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {suggestion.suggested_tags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="px-2 py-0.5 text-xs bg-navy-800/60 text-gold-500/80 rounded-full border border-gold-500/20"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
                          {suggestion.suggested_location_hint && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{suggestion.suggested_location_hint}</span>
                            </span>
                          )}
                          {suggestion.suggested_time_hint && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{suggestion.suggested_time_hint}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{suggestion.suggested_group_size} people</span>
                          </span>
                        </div>

                        {/* CTA */}
                        {isMember && isSteward ? (
                          <button
                            onClick={() => handleHostSuggestion(suggestion)}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Host this
                          </button>
                        ) : (
                          <div className="text-center">
                            <p className="text-xs text-slate-400">
                              Share this idea with a Steward to host
                            </p>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* Chats Section */}
          <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">Group chats</h2>
            {isMember ? (
              <div className="text-center py-6">
                <MessageCircle className="w-12 h-12 text-gold-500/60 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-200 mb-2">
                  Group chats are launching soon
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  You&apos;ll be able to chat with your group members. For now, you can still explore and RSVP to hangouts.
                </p>
                <button
                  onClick={() => router.push(`/chat/${groupId}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-gold-600/40 text-gold-500 px-4 py-2 text-sm font-medium hover:bg-gold-500/10 transition-colors"
                >
                  Go to chats
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-200 mb-2">
                  Join to unlock chats
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Join this group to access group chats and connect with members.
                </p>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            )}
          </section>

          {/* Members Preview */}
          {memberships.length > 0 && (
            <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-50">
                  Members ({memberships.length})
                </h2>
                {memberships.length > 6 && (
                  <button
                    onClick={() => router.push(`/fellowship/${group.id}/members`)}
                    className="text-xs text-gold-500 hover:text-gold-600 transition-colors"
                  >
                    View all →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {memberships.slice(0, 6).map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center gap-3 p-3 bg-navy-900/60 border border-white/10 rounded-xl"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-gold-600 rounded-full flex items-center justify-center text-navy-900 font-semibold text-sm">
                      {getUserInitial(membership)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {getUserName(membership)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {membership.role === 'admin' ? 'Admin' : 'Member'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

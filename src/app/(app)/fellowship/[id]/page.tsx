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
  Share2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import MemberInviteModal from '@/components/MemberInviteModal'
import UserProfileModal from '@/components/UserProfileModal'
import { Skeleton, SkeletonText, SkeletonAvatar } from '@/components/ui/Skeleton'

const SUGGESTIONS_CACHE_KEY = (groupId: string) => `gathered_suggestions_${groupId}`

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
  const [isPendingMember, setIsPendingMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isSoleAdmin, setIsSoleAdmin] = useState(false)
  const [showSoleAdminWarning, setShowSoleAdminWarning] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string>('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [groupId, setGroupId] = useState<string>('')
  const [suggestions, setSuggestions] = useState<SuggestionWithCategory[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [membersList, setMembersList] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Resolve params
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolvedParams = params instanceof Promise ? await params : params
        setGroupId(resolvedParams?.id || '')
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

  // Gate AI suggestions: only if user is a member AND no events AND not cached
  useEffect(() => {
    if (!eventsLoading && upcomingEvents.length === 0 && isMember && group) {
      const cacheKey = SUGGESTIONS_CACHE_KEY(groupId)
      try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          setSuggestions(JSON.parse(cached))
          return
        }
      } catch {}
      generateSuggestions()
    } else if (upcomingEvents.length > 0) {
      setSuggestions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsLoading, upcomingEvents.length, isMember, group])

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

      if (user) {
        try {
          const userMembership = await FellowshipService.getUserMembershipForGroup(user.id, groupId)
          const memberStatus = !!userMembership
          const adminStatus = userMembership?.role === 'admin'
          setIsMember(memberStatus)
          setIsAdmin(adminStatus)
          // Always call — API uses service role so it's the authoritative membership check.
          // It also corrects isMember if RLS blocked getUserMembershipForGroup above.
          loadMembersList()

          if (!memberStatus) {
            const pending = await FellowshipService.hasPendingRequest(groupId, user.id)
            setIsPendingMember(pending)
          } else {
            setIsPendingMember(false)
          }

          // Check if sole admin (needed for leave protection)
          if (adminStatus) {
            const adminCount = await FellowshipService.getAdminCount(groupId)
            setIsSoleAdmin(adminCount === 1)
          } else {
            setIsSoleAdmin(false)
          }
        } catch (error) {
          console.error('Error checking membership:', error)
          const userMembership = membershipsData?.find(m => m.user_id === user.id)
          setIsMember(!!userMembership)
          setIsAdmin(userMembership?.role === 'admin')
          loadMembersList()
        }
      } else {
        setIsMember(false)
        setIsAdmin(false)
        setIsPendingMember(false)
      }
    } catch (error: any) {
      console.error('Error loading group:', error)
      if (error.code !== 'PGRST301' && !error.message?.includes('JWT')) {
        toast({ title: 'Error', description: 'Failed to load group. Please try refreshing.', variant: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  const loadUpcomingEvents = async () => {
    if (!groupId) return
    try {
      setEventsLoading(true)
      const events = await EventService.getEvents(user?.id, groupId)
      const now = new Date().toISOString()
      const upcoming = events
        .filter(event => event.start_time >= now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5)
      setUpcomingEvents(upcoming)
    } catch (error) {
      console.error('Error loading events:', error)
      setUpcomingEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const loadMembersList = async () => {
    if (!groupId || !user) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/fellowship/${groupId}/members`, {
        headers: { Authorization: session?.access_token ? `Bearer ${session.access_token}` : '' },
      })
      if (res.ok) {
        const data = await res.json()
        setMembersList(data.members || [])
        // API uses service role — 200 means the user is confirmed as an active member
        setIsMember(true)
      }
      // 403 means not a member — leave isMember as-is (already set by getUserMembershipForGroup)
    } catch {
      // keep existing state
    }
  }

  const generateSuggestions = async () => {
    if (!group) return
    try {
      setSuggestionsLoading(true)
      const groupContext = [
        group.name,
        group.description || '',
        group.location ? `in ${group.location}` : '',
        group.meeting_schedule ? `meeting ${group.meeting_schedule}` : '',
      ].filter(Boolean).join(', ')

      const suggestionConfigs = [
        {
          category: 'chill' as const,
          description: `A casual coffee hangout for ${group.name}. ${groupContext}. Relaxed social connection.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Friday evening',
          comfort_level: 'small group',
        },
        {
          category: 'activity' as const,
          description: `An active event for ${group.name}. ${groupContext}. Sports, games, or creative workshop.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Saturday afternoon',
          comfort_level: 'medium group',
        },
        {
          category: 'service' as const,
          description: `Community service for ${group.name}. ${groupContext}. Giving back together.`,
          location_hint: group.location || undefined,
          time_hint: group.meeting_schedule || 'Sunday afternoon',
          comfort_level: 'small group',
        },
      ]

      const responses = await Promise.all(
        suggestionConfigs.map(config =>
          fetch('/api/agents/ActivityPlanner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: config.description,
              location_hint: config.location_hint,
              time_hint: config.time_hint,
              comfort_level: config.comfort_level,
            } as ActivityPlannerRequest),
          })
        )
      )

      const results = await Promise.all(
        responses.map(async (res, index) => {
          if (!res.ok) return null
          const data: ActivityPlannerAPIResponse = await res.json()
          return { ...data.data, category: suggestionConfigs[index].category } as SuggestionWithCategory
        })
      )

      const seenTitles = new Set<string>()
      const unique: SuggestionWithCategory[] = []
      for (const s of results) {
        if (!s) continue
        const norm = s.suggested_title.toLowerCase().trim().replace(/\s+/g, ' ')
        const isDupe = Array.from(seenTitles).some(t => t === norm || t.includes(norm) || norm.includes(t))
        if (!isDupe) { seenTitles.add(norm); unique.push(s) }
      }

      const final = unique.slice(0, 3)
      setSuggestions(final)
      try { sessionStorage.setItem(SUGGESTIONS_CACHE_KEY(groupId), JSON.stringify(final)) } catch {}
    } catch (error) {
      console.error('Error generating suggestions:', error)
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const handleHostSuggestion = (suggestion: SuggestionWithCategory) => {
    const p = new URLSearchParams({
      group_id: groupId,
      title: suggestion.suggested_title,
      description: suggestion.suggested_description,
      tags: suggestion.suggested_tags.join(','),
      location_hint: suggestion.suggested_location_hint,
      time_hint: suggestion.suggested_time_hint,
    })
    router.push(`/events/create?${p.toString()}`)
  }

  const handleCreateInvite = async () => {
    if (!user || !group || !isMember) return
    setCreatingInvite(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please log in to create invites')

      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ invite_type: 'group', group_id: groupId }),
      })

      if (response.status === 403) {
        toast({ title: 'You need to join this group before inviting others.', variant: 'error' })
        return
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create invite')
      }

      const data = await response.json()
      const url = data?.inviteUrl || data?.invite?.invite_url
      if (!url) throw new Error('Invite link was not returned. Please try again.')
      setInviteUrl(url)
      setShowInviteModal(true)
    } catch (error: any) {
      toast({ title: 'Failed to create invite', description: error.message || 'Please try again', variant: 'error' })
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
        setIsPendingMember(true)
        toast({ title: 'Request sent', description: 'Your join request has been sent to the group admin', variant: 'success' })
      } else {
        await FellowshipService.joinGroup(groupId, user.id)
        toast({ title: 'Joined group', description: 'Welcome to the group!', variant: 'success' })
        await loadGroupData()
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to join group', variant: 'error' })
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveIntent = () => {
    if (isSoleAdmin) {
      setShowSoleAdminWarning(true)
    } else {
      setShowLeaveConfirm(true)
    }
  }

  const handleLeave = async () => {
    if (!user || !group) return
    setLeaving(true)
    try {
      await FellowshipService.leaveGroup(groupId, user.id)
      toast({ title: 'Left group', description: 'You have left this fellowship group', variant: 'success' })
      setShowLeaveConfirm(false)
      router.push('/fellowship')
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to leave group', variant: 'error' })
    } finally {
      setLeaving(false)
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
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
      <main className="min-h-screen bg-navy-900 text-slate-50">
        {/* Hero skeleton */}
        <div className="relative">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 space-y-3">
            <Skeleton className="h-8 w-56" />
            <SkeletonText width="1/2" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </div>
        {/* Member rows skeleton */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <SkeletonAvatar size="md" />
              <div className="flex-1 space-y-1.5">
                <SkeletonText width="1/3" />
                <SkeletonText width="1/4" />
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  if (!group) {
    return (
      <main className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50 mb-4">Group Not Found</h1>
          <p className="text-slate-400 mb-6">This group doesn&apos;t exist or has been removed.</p>
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
      {/* Hero Header */}
      <div className="relative">
        <div className="h-48 w-full" style={{ background: getGradientFromName(group.name) }} />
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
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-50">{group.name}</h1>
                {group.is_private ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/60 border border-white/20 rounded-full text-xs text-slate-300">
                    <Lock className="w-3 h-3" /><span>Private</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/60 border border-white/20 rounded-full text-xs text-slate-300">
                    <Globe className="w-3 h-3" /><span>Public</span>
                  </span>
                )}
                {isMember && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gold-500/20 border border-gold-500/40 rounded-full text-xs text-gold-500">
                    Member
                  </span>
                )}
                {isPendingMember && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/15 rounded-full text-xs text-slate-400">
                    <Clock className="w-3 h-3" />Request Pending
                  </span>
                )}
              </div>
              <p className="text-slate-200 text-lg mb-4">{group.description}</p>
              <div className="flex flex-wrap items-center gap-3">
                {group.location && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                    <MapPin className="w-4 h-4" /><span>{group.location}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                  <Users className="w-4 h-4" />
                  <span>{group.member_count || 0} {group.member_count === 1 ? 'member' : 'members'}</span>
                </div>
                {group.meeting_schedule && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900/60 border border-white/20 rounded-full text-sm text-slate-300">
                    <Calendar className="w-4 h-4" /><span>{group.meeting_schedule}</span>
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
          {!isMember && !isPendingMember ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900" /><span>Joining…</span></>
              ) : (
                <><UserPlus className="w-5 h-5" /><span>{group.is_private ? 'Request to Join' : 'Join Group'}</span></>
              )}
            </button>
          ) : isPendingMember ? (
            <button
              disabled
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 text-slate-500 px-6 py-3 text-sm font-medium cursor-not-allowed"
            >
              <Clock className="w-5 h-5" /><span>Request Pending</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleLeaveIntent}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-5 h-5" /><span>Leave Group</span>
              </button>
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-600/40 text-gold-500 px-6 py-3 text-sm font-medium hover:bg-gold-500/10 transition-colors disabled:opacity-50"
              >
                {creatingInvite
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gold-500" /><span>Creating…</span></>
                  : <><Share2 className="w-5 h-5" /><span>Invite to Group</span></>
                }
              </button>
              <button
                onClick={() => router.push(`/chat/${groupId}`)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gold-600/40 text-gold-500 px-6 py-3 text-sm font-medium hover:bg-gold-500/10 transition-colors"
              >
                <MessageCircle className="w-5 h-5" /><span>Go to Chats</span>
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

        {/* Sole Admin Warning */}
        {showSoleAdminWarning && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-50">You&apos;re the only admin</h3>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                If you leave, this group will have no admin. Please promote another member to admin before leaving, or remove all members and delete the group.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSoleAdminWarning(false)}
                  className="flex-1 rounded-xl border border-white/20 text-slate-300 px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowSoleAdminWarning(false); router.push(`/fellowship/${groupId}/manage`) }}
                  className="flex-1 rounded-xl bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
                >
                  Go to Manage
                </button>
              </div>
            </div>
          </div>
        )}

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
                  {leaving ? 'Leaving…' : 'Leave Group'}
                </button>
              </div>
            </div>
          </div>
        )}

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
            <p className="text-sm text-slate-400">Loading events…</p>
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
                        <h3 className="text-sm font-semibold text-slate-200 truncate mb-1">{event.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{date}</span></span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>{time}</span></span>
                          {event.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate">{event.location}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Users className="w-4 h-4" /><span>{event.rsvp_count}</span>
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
                <p className="text-sm text-slate-300 mb-1">No hangouts scheduled yet</p>
                <p className="text-xs text-slate-400">
                  {isMember && isSteward ? 'Host the first hangout for this group' : 'Stewards can host the first one'}
                </p>
              </div>

              {/* Suggested Hangouts — only shown to members */}
              {isMember && (
                suggestionsLoading ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-400">Generating ideas…</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200">Suggested hangouts</h3>
                    {suggestions.map((suggestion, index) => {
                      const badgeClass = suggestion.category === 'chill'
                        ? 'bg-gold-500/15 text-gold-500 border-gold-600/30'
                        : suggestion.category === 'activity'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-400/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-400/30'
                      const badgeLabel = { chill: 'Chill', activity: 'Activity', service: 'Service' }[suggestion.category]

                      return (
                        <div key={index} className="p-4 bg-navy-900/60 border border-white/10 rounded-xl hover:border-gold-500/30 transition-all">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeClass}`}>{badgeLabel}</span>
                                <h4 className="text-sm font-semibold text-slate-200">{suggestion.suggested_title}</h4>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">{suggestion.suggested_description}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
                            {suggestion.suggested_location_hint && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{suggestion.suggested_location_hint}</span>
                            )}
                            {suggestion.suggested_time_hint && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{suggestion.suggested_time_hint}</span>
                            )}
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{suggestion.suggested_group_size} people</span>
                          </div>
                          {isSteward ? (
                            <button
                              onClick={() => handleHostSuggestion(suggestion)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
                            >
                              <Plus className="w-4 h-4" />Host this
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400 text-center">Share this idea with a Steward to host</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null
              )}
            </div>
          )}
        </section>

        {/* Group Chats */}
        <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">Group chats</h2>
          {isMember ? (
            <div className="text-center py-6">
              <MessageCircle className="w-12 h-12 text-gold-500/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-200 mb-2">Group chats</p>
              <p className="text-xs text-slate-400 mb-4">Stay connected — share reflections, prayer requests, and encouragement.</p>
              <button
                onClick={() => router.push(`/chat/${groupId}`)}
                className="inline-flex items-center gap-2 rounded-full border border-gold-600/40 text-gold-500 px-4 py-2 text-sm font-medium hover:bg-gold-500/10 transition-colors"
              >
                Open chats
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-200 mb-2">Join to unlock chats</p>
              <p className="text-xs text-slate-400 mb-4">Join this group to access group chats and connect with members.</p>
              {!isPendingMember && (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
                >
                  {joining ? 'Joining…' : group.is_private ? 'Request to Join' : 'Join Group'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Members */}
        {isMember && membersList.length > 0 && (
          <section className="bg-navy-900/40 border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">
              Members ({membersList.filter((m: any) => m.status === 'active').length})
            </h2>
            <div className="space-y-2">
              {membersList
                .filter((m: any) => m.status === 'active')
                .map((member: any) => {
                  const name = member.user?.name || 'Member'
                  const initial = name.charAt(0).toUpperCase()
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedUserId(member.user_id)}
                      className="w-full flex items-center gap-3 p-3 bg-navy-900/60 border border-white/10 rounded-xl hover:border-gold-500/30 hover:bg-navy-800/60 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {member.user?.avatar_url ? (
                          <img src={member.user.avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-gold-500">{initial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{name}</div>
                        <div className="text-xs text-slate-400">{member.role === 'admin' ? 'Admin' : 'Member'}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    </button>
                  )
                })}
            </div>
          </section>
        )}
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </main>
  )
}

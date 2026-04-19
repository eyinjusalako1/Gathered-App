'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { FellowshipGroup } from '@/types'
import {
  Plus,
  Search,
  MapPin,
  Users,
  Lock,
  Globe,
  Calendar,
  Filter,
  Heart,
  Sparkles,
  ArrowRight,
  Clock
} from 'lucide-react'
import { getGradientFromName } from '@/utils/gradient'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function FellowshipPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { isSteward } = useUserProfile()
  const toast = useToast()
  const [groups, setGroups] = useState<FellowshipGroup[]>([])
  const [userJoinedGroupIds, setUserJoinedGroupIds] = useState<Set<string>>(new Set())
  const [userPendingGroupIds, setUserPendingGroupIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPrivacy, setFilterPrivacy] = useState<string>('all')
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null)

  useEffect(() => {
    loadGroups()
    loadUserMemberships()
  }, [user?.id])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const data = await FellowshipService.getGroups(user?.id)
      setGroups(data)
    } catch (error) {
      console.error('Error loading groups:', error)
      toast({ title: 'Error', description: 'Failed to load groups. Please try again.', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadUserMemberships = async () => {
    if (!user?.id) {
      setUserJoinedGroupIds(new Set())
      setUserPendingGroupIds(new Set())
      return
    }
    try {
      const [joinedGroups, pendingIds] = await Promise.all([
        FellowshipService.getUserJoinedGroups(user.id),
        FellowshipService.getUserPendingGroupIds(user.id),
      ])
      setUserJoinedGroupIds(new Set(joinedGroups.map(g => g.id)))
      setUserPendingGroupIds(pendingIds)
    } catch (error) {
      console.error('Error loading user memberships:', error)
      setUserJoinedGroupIds(new Set())
      setUserPendingGroupIds(new Set())
    }
  }

  const filteredAndSortedGroups = useMemo(() => {
    let filtered = groups.filter(group => {
      const matchesSearch =
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || group.group_type === filterType
      const matchesPrivacy =
        filterPrivacy === 'all' ||
        (filterPrivacy === 'public' && !group.is_private) ||
        (filterPrivacy === 'private' && group.is_private)
      return matchesSearch && matchesType && matchesPrivacy
    })

    filtered.sort((a, b) => {
      const aIsMember = userJoinedGroupIds.has(a.id)
      const bIsMember = userJoinedGroupIds.has(b.id)
      if (aIsMember && !bIsMember) return -1
      if (!aIsMember && bIsMember) return 1
      return (b.member_count || 0) - (a.member_count || 0)
    })

    return filtered
  }, [groups, searchTerm, filterType, filterPrivacy, userJoinedGroupIds])

  const isFiltering = searchTerm || filterType !== 'all' || filterPrivacy !== 'all'
  const userHasNoGroups = userJoinedGroupIds.size === 0 && userPendingGroupIds.size === 0
  const showNewUserEmpty = !loading && !isFiltering && filteredAndSortedGroups.length === 0 && userHasNoGroups

  const handleJoinGroup = async (e: React.MouseEvent, group: FellowshipGroup) => {
    e.stopPropagation()
    if (!user) {
      toast({ title: 'Please sign in', description: 'You must be signed in to join a group', variant: 'error' })
      return
    }
    setJoiningGroupId(group.id)
    try {
      if (group.is_private) {
        await FellowshipService.requestToJoinGroup(group.id, user.id)
        setUserPendingGroupIds(prev => new Set(Array.from(prev).concat(group.id)))
        toast({ title: 'Request sent', description: 'Your join request has been sent to the group admin', variant: 'success' })
      } else {
        await FellowshipService.joinGroup(group.id, user.id)
        await Promise.all([loadGroups(), loadUserMemberships()])
        toast({ title: 'Joined!', description: `Welcome to ${group.name}`, variant: 'success' })
      }
    } catch (error: any) {
      console.error('Error joining group:', error)
      toast({ title: 'Error', description: error.message || 'Failed to join group', variant: 'error' })
    } finally {
      setJoiningGroupId(null)
    }
  }

  const getActionButton = (group: FellowshipGroup) => {
    const isMember = userJoinedGroupIds.has(group.id)
    const isPending = userPendingGroupIds.has(group.id)
    const isJoining = joiningGroupId === group.id

    if (isMember) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/fellowship/${group.id}`) }}
          className="w-full rounded-xl border border-gold-600/40 text-gold-500 px-4 py-2.5 text-sm font-semibold hover:bg-gold-500/10 transition-colors flex items-center justify-center gap-2"
        >
          <span>Open</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )
    }

    if (isPending) {
      return (
        <button
          disabled
          className="w-full rounded-xl border border-white/10 text-slate-500 px-4 py-2.5 text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Clock className="w-4 h-4" />
          <span>Request Pending</span>
        </button>
      )
    }

    return (
      <button
        onClick={(e) => handleJoinGroup(e, group)}
        disabled={!!isJoining}
        className="w-full rounded-xl bg-gold-500 text-navy-900 px-4 py-2.5 text-sm font-semibold hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isJoining ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-900" />
            <span>Joining…</span>
          </>
        ) : (
          <span>{group.is_private ? 'Request to Join' : 'Join Group'}</span>
        )}
      </button>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-navy-900 text-slate-50 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-navy-900/40 border border-white/10 rounded-2xl overflow-hidden">
                <Skeleton className="h-24 w-full rounded-none" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <SkeletonText width="full" />
                  <SkeletonText width="2/3" />
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-50">Fellowship Groups</h1>
            <p className="mt-2 text-slate-400">Find and join Christian fellowship groups in your area</p>
          </div>
          {user && isSteward && (
            <button
              onClick={() => router.push('/fellowship/create')}
              className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Group</span>
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search groups…"
                  className="w-full bg-navy-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-slate-50 placeholder-slate-400 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="w-full bg-navy-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-slate-50 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="bible_study">Bible Study</option>
                <option value="prayer_group">Prayer Group</option>
                <option value="fellowship">Fellowship</option>
                <option value="youth_group">Youth Group</option>
                <option value="senior_group">Senior Group</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <select
                className="w-full bg-navy-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-slate-50 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors"
                value={filterPrivacy}
                onChange={(e) => setFilterPrivacy(e.target.value)}
              >
                <option value="all">All Groups</option>
                <option value="public">Public Only</option>
                <option value="private">Private Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty States */}
        {filteredAndSortedGroups.length === 0 ? (
          showNewUserEmpty ? (
            /* New-user welcome empty state */
            <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-10 h-10 text-gold-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-50 mb-3">Find your community</h3>
              <p className="text-slate-300 max-w-md mx-auto mb-8">
                Fellowship groups are where real community happens — Bible studies, prayer circles, social hangouts, and more.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => router.push('/discover')}
                  className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-5 py-2.5 text-sm font-semibold hover:bg-gold-600 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  Explore Discover
                </button>
                {user && isSteward && (
                  <button
                    onClick={() => router.push('/fellowship/create')}
                    className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 text-gold-300 px-5 py-2.5 text-sm font-semibold hover:bg-gold-500/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Start a group
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Filter-empty state */
            <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-12 text-center">
              <Heart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-200 mb-2">No groups found</h3>
              <p className="text-slate-400 mb-6">
                {isFiltering ? 'Try adjusting your search or filters' : 'Be the first to create a fellowship group!'}
              </p>
              {isFiltering && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterPrivacy('all') }}
                  className="text-sm text-gold-500 hover:text-gold-400 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedGroups.map((group) => {
              const isMember = userJoinedGroupIds.has(group.id)
              const isPending = userPendingGroupIds.has(group.id)

              return (
                <div
                  key={group.id}
                  className="bg-navy-900/40 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 hover:shadow-[0_0_20px_rgba(245,196,81,0.2)] transition-all cursor-pointer group"
                  onClick={() => router.push(`/fellowship/${group.id}`)}
                >
                  <div
                    className="h-24 w-full"
                    style={{ background: getGradientFromName(group.name) }}
                  />
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-50 truncate group-hover:text-gold-500 transition-colors">
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {group.is_private ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Lock className="w-3 h-3" /><span>Private</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Globe className="w-3 h-3" /><span>Public</span>
                            </span>
                          )}
                          {isMember && (
                            <span className="inline-flex items-center gap-1 text-xs text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded-full">
                              Member
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-2">{group.description}</p>

                    {group.location && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-navy-900/60 border border-white/10 rounded-full text-xs text-slate-300">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{group.location}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{group.member_count || 0} {group.member_count === 1 ? 'member' : 'members'}</span>
                      </div>
                      {group.meeting_schedule && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="w-4 h-4" />
                          <span className="truncate max-w-[100px]">{group.meeting_schedule}</span>
                        </div>
                      )}
                    </div>

                    {getActionButton(group)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

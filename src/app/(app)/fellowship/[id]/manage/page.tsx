'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { EventService } from '@/lib/event-service'
import { FellowshipGroup, GroupMembership, Event } from '@/types'
import { supabase } from '@/lib/supabase'
import { 
  Users, 
  Calendar, 
  MessageCircle,
  Settings,
  ArrowLeft,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  Crown,
  UserMinus,
  ArrowUp,
  ArrowDown,
  Loader2,
  ExternalLink
} from 'lucide-react'

interface MemberWithProfile extends GroupMembership {
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string | null
  }
}

export default function FellowshipManagePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const { user } = useAuth()
  const { isSteward } = useUserProfile()
  const toast = useToast()
  const [groupId, setGroupId] = useState<string>('')
  const [group, setGroup] = useState<FellowshipGroup | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [lastChatActivity, setLastChatActivity] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active')
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Resolve params
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

  // Check access and load data
  useEffect(() => {
    if (groupId && user?.id) {
      checkAccessAndLoad()
    }
  }, [groupId, user?.id])

  const checkAccessAndLoad = async () => {
    if (!groupId || !user?.id) return

    try {
      setLoading(true)

      // Check if user is admin or steward
      const groupData = await FellowshipService.getGroup(groupId)
      setGroup(groupData)

      // Get user's membership
      const userMembership = await FellowshipService.getUserMembershipForGroup(user.id, groupId)
      const userIsAdmin = userMembership?.role === 'admin'
      const userIsSteward = isSteward

      if (!userIsAdmin && !userIsSteward) {
        setHasAccess(false)
        toast({
          title: 'Access Denied',
          description: 'Only group admins and stewards can manage this fellowship.',
          variant: 'error',
          duration: 3000,
        })
        router.push(`/fellowship/${groupId}`)
        return
      }

      setHasAccess(true)
      await loadData()
    } catch (error) {
      console.error('Error checking access:', error)
      setHasAccess(false)
      toast({
        title: 'Error',
        description: 'Failed to load fellowship data.',
        variant: 'error',
        duration: 3000,
      })
      router.push(`/fellowship/${groupId}`)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!groupId) return

    try {
      // Load members
      const { data: { session } } = await supabase.auth.getSession()
      const membersResponse = await fetch(`/api/fellowship/${groupId}/members`, {
        headers: {
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      })

      if (membersResponse.ok) {
        const membersData = await membersResponse.json()
        setMembers(membersData.members || [])
      }

      // Load upcoming events
      const events = await EventService.getEvents(undefined, groupId)
      setUpcomingEvents(events.filter(e => {
        const eventDate = new Date(e.start_time)
        return eventDate > new Date()
      }))

      // Load last chat activity
      const chatResponse = await fetch(`/api/chat/group/${groupId}`, {
        headers: {
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      })

      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        const messages = chatData.messages || []
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1]
          setLastChatActivity(lastMessage.created_at)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleMemberAction = async (action: string, membershipId: string, userId?: string) => {
    if (!groupId) return

    setActionLoading(membershipId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`/api/fellowship/${groupId}/members/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ action, membershipId, userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform action')
      }

      toast({
        title: 'Success',
        description: data.message || 'Action completed successfully',
        variant: 'success',
        duration: 3000,
      })

      // Reload data
      await loadData()
    } catch (error: any) {
      console.error('Error performing action:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'error',
        duration: 3000,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const getInitials = (name: string): string => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name[0].toUpperCase()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading || hasAccess === null) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null // Will redirect
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      {/* Header */}
      <div className="bg-navy-800/50 border-b border-white/10 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/fellowship/${groupId}`)}
              className="text-slate-400 hover:text-slate-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">Manage Fellowship</h1>
              {group && (
                <p className="text-xs text-slate-400">{group.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Members Count */}
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-50">{activeMembers.length}</div>
                <div className="text-xs text-slate-400">Active Members</div>
              </div>
            </div>
          </div>

          {/* Upcoming Hangouts */}
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-50">{upcomingEvents.length}</div>
                <div className="text-xs text-slate-400">Upcoming Hangouts</div>
              </div>
            </div>
          </div>

          {/* Last Chat Activity */}
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-50">
                  {lastChatActivity ? formatTime(lastChatActivity) : 'No activity'}
                </div>
                <div className="text-xs text-slate-400">Last Chat Activity</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-50 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => router.push(`/events/create?group_id=${groupId}`)}
              className="flex items-center space-x-2 bg-gold-500/10 border border-gold-500/30 text-gold-500 hover:bg-gold-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Host Hangout</span>
            </button>
            <button
              onClick={() => router.push(`/chat/${groupId}`)}
              className="flex items-center space-x-2 bg-navy-800/60 border border-white/10 text-slate-50 hover:bg-navy-800/80 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Open Chat</span>
            </button>
            <button
              onClick={() => router.push(`/fellowship/${groupId}`)}
              className="flex items-center space-x-2 bg-navy-800/60 border border-white/10 text-slate-50 hover:bg-navy-800/80 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>View Group</span>
            </button>
          </div>
        </div>

        {/* Member Management */}
        <div className="bg-navy-900/40 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-50">Member Management</h3>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6 bg-navy-800/60 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Active ({activeMembers.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Pending ({pendingMembers.length})
            </button>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            {activeTab === 'active' ? (
              activeMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No active members</p>
                </div>
              ) : (
                activeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-navy-800/60 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                          {member.user.avatar_url ? (
                            <img
                              src={member.user.avatar_url}
                              alt={member.user.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-gold-500">
                              {getInitials(member.user.name)}
                            </span>
                          )}
                        </div>

                        {/* Member Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-slate-50 truncate">{member.user.name}</h4>
                            {member.role === 'admin' && (
                              <Crown className="w-4 h-4 text-gold-500 flex-shrink-0" />
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              member.role === 'admin'
                                ? 'bg-gold-500/20 text-gold-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {member.role}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 truncate">{member.user.email}</p>
                          <p className="text-xs text-slate-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        {member.role === 'member' && (
                          <button
                            onClick={() => handleMemberAction('promote', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Promote to Admin"
                          >
                            {actionLoading === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArrowUp className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {member.role === 'admin' && member.user_id !== user?.id && (
                          <button
                            onClick={() => handleMemberAction('demote', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
                            title="Demote to Member"
                          >
                            {actionLoading === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {member.user_id !== user?.id && (
                          <button
                            onClick={() => handleMemberAction('remove', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Remove Member"
                          >
                            {actionLoading === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserMinus className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              pendingMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pending members</p>
                </div>
              ) : (
                pendingMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-navy-800/60 border border-gold-500/30 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                          {member.user.avatar_url ? (
                            <img
                              src={member.user.avatar_url}
                              alt={member.user.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-gold-500">
                              {getInitials(member.user.name)}
                            </span>
                          )}
                        </div>

                        {/* Member Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-50 mb-1">{member.user.name}</h4>
                          <p className="text-sm text-slate-400">{member.user.email}</p>
                          <p className="text-xs text-slate-500">
                            Requested {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMemberAction('approve', member.id)}
                          disabled={actionLoading === member.id}
                          className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleMemberAction('reject', member.id)}
                          disabled={actionLoading === member.id}
                          className="flex items-center space-x-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


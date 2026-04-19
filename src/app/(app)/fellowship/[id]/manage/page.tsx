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
import TagChipSelector from '@/components/fellowship/TagChipSelector'
import { FOCUS_TAGS } from '@/lib/fellowship/focusTags'
import {
  Users,
  Calendar,
  MessageCircle,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  UserMinus,
  ArrowUp,
  ArrowDown,
  Loader2,
  Settings,
  Save,
} from 'lucide-react'

interface MemberWithProfile extends GroupMembership {
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string | null
  }
}

type ManageTab = 'active' | 'pending' | 'edit'

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
  const [activeTab, setActiveTab] = useState<ManageTab>('active')
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editPrivacy, setEditPrivacy] = useState<'open' | 'request'>('open')
  const [editMaxMembers, setEditMaxMembers] = useState<string>('')
  const [editSaving, setEditSaving] = useState(false)

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
    if (groupId && user?.id) checkAccessAndLoad()
  }, [groupId, user?.id])

  const checkAccessAndLoad = async () => {
    if (!groupId || !user?.id) return
    try {
      setLoading(true)
      const groupData = await FellowshipService.getGroup(groupId)
      setGroup(groupData)

      const userMembership = await FellowshipService.getUserMembershipForGroup(user.id, groupId)
      const userIsAdmin = userMembership?.role === 'admin'

      if (!userIsAdmin && !isSteward) {
        setHasAccess(false)
        toast({ title: 'Access Denied', description: 'Only group admins can manage this fellowship.', variant: 'error', duration: 3000 })
        router.push(`/fellowship/${groupId}`)
        return
      }

      setHasAccess(true)

      // Pre-populate edit form from group data
      if (groupData) {
        setEditName(groupData.name)
        setEditDescription(groupData.description)
        const validTagValues = new Set(FOCUS_TAGS.map(t => t.value))
        setEditTags(groupData.tags.filter(t => validTagValues.has(t)))
        setEditPrivacy(groupData.is_private ? 'request' : 'open')
        setEditMaxMembers(groupData.max_members ? String(groupData.max_members) : '')
      }

      await loadData()
    } catch (error) {
      console.error('Error checking access:', error)
      setHasAccess(false)
      router.push(`/fellowship/${groupId}`)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!groupId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}

      const [membersResponse, events, chatResponse] = await Promise.all([
        fetch(`/api/fellowship/${groupId}/members`, { headers: authHeader }),
        EventService.getEvents(undefined, groupId),
        fetch(`/api/chat/group/${groupId}`, { headers: authHeader }),
      ])

      if (membersResponse.ok) {
        const data = await membersResponse.json()
        setMembers(data.members || [])
      }

      setUpcomingEvents(events.filter(e => new Date(e.start_time) > new Date()))

      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        const msgs = chatData.messages || []
        if (msgs.length > 0) setLastChatActivity(msgs[msgs.length - 1].created_at)
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
      if (!response.ok) throw new Error(data.error || 'Failed to perform action')
      toast({ title: 'Done', description: data.message || 'Action completed', variant: 'success', duration: 3000 })
      await loadData()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to perform action', variant: 'error', duration: 3000 })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!groupId) return
    if (editName.trim().length < 3) {
      toast({ title: 'Name too short', description: 'Group name must be at least 3 characters', variant: 'error' })
      return
    }
    setEditSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`/api/fellowship/${groupId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          tags: editTags,
          is_private: editPrivacy === 'request',
          max_members: editMaxMembers ? parseInt(editMaxMembers) : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save changes')
      setGroup(data.group)
      toast({ title: 'Saved', description: 'Group details updated', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'error' })
    } finally {
      setEditSaving(false)
    }
  }

  const getInitials = (name: string): string => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return name[0].toUpperCase()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
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
          <p className="text-slate-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) return null

  const activeMembers = members.filter(m => m.status === 'active')
  const pendingMembers = members.filter(m => m.status === 'pending')

  const tabs: { id: ManageTab; label: string; count?: number }[] = [
    { id: 'active', label: 'Active', count: activeMembers.length },
    { id: 'pending', label: 'Pending', count: pendingMembers.length },
    { id: 'edit', label: 'Edit Group' },
  ]

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      {/* Header */}
      <div className="bg-navy-800/50 border-b border-white/10 px-4 py-3 sticky z-10" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.push(`/fellowship/${groupId}`)} className="text-slate-400 hover:text-slate-50 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">Manage Fellowship</h1>
              {group && <p className="text-xs text-slate-400">{group.name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-50">{activeMembers.length}</div>
                <div className="text-xs text-slate-400">Active Members</div>
              </div>
            </div>
          </div>
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-50">{upcomingEvents.length}</div>
                <div className="text-xs text-slate-400">Upcoming Hangouts</div>
              </div>
            </div>
          </div>
          <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-50">
                  {lastChatActivity ? formatTime(lastChatActivity) : 'No activity'}
                </div>
                <div className="text-xs text-slate-400">Last Chat</div>
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
              <Calendar className="w-4 h-4" /><span>Host Hangout</span>
            </button>
            <button
              onClick={() => router.push(`/chat/${groupId}`)}
              className="flex items-center space-x-2 bg-navy-800/60 border border-white/10 text-slate-50 hover:bg-navy-800/80 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" /><span>Open Chat</span>
            </button>
            <button
              onClick={() => router.push(`/fellowship/${groupId}`)}
              className="flex items-center space-x-2 bg-navy-800/60 border border-white/10 text-slate-50 hover:bg-navy-800/80 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Settings className="w-4 h-4" /><span>View Group</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-navy-900/40 border border-white/10 rounded-xl p-6">
          {/* Tab Header */}
          <div className="flex space-x-1 mb-6 bg-navy-800/60 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-gold-500 text-navy-900' : 'text-slate-400 hover:text-slate-50'
                }`}
              >
                {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>

          {/* Active Members */}
          {activeTab === 'active' && (
            <div className="space-y-3">
              {activeMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No active members</p>
                </div>
              ) : (
                activeMembers.map((member) => (
                  <div key={member.id} className="bg-navy-800/60 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                          {member.user.avatar_url ? (
                            <img src={member.user.avatar_url} alt={member.user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-gold-500">{getInitials(member.user.name)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-slate-50 truncate">{member.user.name}</h4>
                            {member.role === 'admin' && <Crown className="w-4 h-4 text-gold-500 flex-shrink-0" />}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.role === 'admin' ? 'bg-gold-500/20 text-gold-400' : 'bg-slate-700 text-slate-300'}`}>
                              {member.role}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 truncate">{member.user.email}</p>
                          <p className="text-xs text-slate-500">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {member.role === 'member' && (
                          <button
                            onClick={() => handleMemberAction('promote', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Promote to Admin"
                          >
                            {actionLoading === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                          </button>
                        )}
                        {member.role === 'admin' && member.user_id !== user?.id && (
                          <button
                            onClick={() => handleMemberAction('demote', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
                            title="Demote to Member"
                          >
                            {actionLoading === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
                          </button>
                        )}
                        {member.user_id !== user?.id && (
                          <button
                            onClick={() => handleMemberAction('remove', member.id)}
                            disabled={actionLoading === member.id}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Remove Member"
                          >
                            {actionLoading === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending Members */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pending join requests</p>
                </div>
              ) : (
                pendingMembers.map((member) => (
                  <div key={member.id} className="bg-navy-800/60 border border-gold-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                          {member.user.avatar_url ? (
                            <img src={member.user.avatar_url} alt={member.user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-gold-500">{getInitials(member.user.name)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-50 mb-1">{member.user.name}</h4>
                          <p className="text-sm text-slate-400">{member.user.email}</p>
                          <p className="text-xs text-slate-500">Requested {new Date(member.joined_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleMemberAction('approve', member.id)}
                          disabled={actionLoading === member.id}
                          className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><CheckCircle className="w-4 h-4" /><span>Approve</span></>
                          }
                        </button>
                        <button
                          onClick={() => handleMemberAction('reject', member.id)}
                          disabled={actionLoading === member.id}
                          className="flex items-center space-x-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === member.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><XCircle className="w-4 h-4" /><span>Reject</span></>
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Edit Group */}
          {activeTab === 'edit' && (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Group Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={60}
                  className="w-full bg-navy-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors"
                  placeholder="Group name…"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  maxLength={400}
                  className="w-full bg-navy-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors resize-none"
                  placeholder="What is this group about?"
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{editDescription.length}/400</p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Focus Tags</label>
                <p className="text-xs text-slate-400 mb-3">Select up to 4 tags that best describe your group</p>
                <TagChipSelector selected={editTags} onChange={setEditTags} maxSelections={4} />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Visibility</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'open', label: 'Open', description: 'Anyone can join instantly' },
                    { value: 'request', label: 'Request to Join', description: 'New members need your approval' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditPrivacy(opt.value as 'open' | 'request')}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        editPrivacy === opt.value
                          ? 'border-gold-500/60 bg-gold-500/10'
                          : 'border-white/10 bg-navy-800/40 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium text-slate-50 text-sm mb-1">{opt.label}</div>
                      <div className="text-xs text-slate-400">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Members */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Member Limit</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: '', label: 'No limit' },
                    { value: '12', label: '12' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditMaxMembers(opt.value)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        editMaxMembers === opt.value
                          ? 'border-gold-500/60 bg-gold-500/10 text-gold-500'
                          : 'border-white/10 bg-navy-800/40 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || editName.trim().length < 3}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>
                  : <><Save className="w-4 h-4" /><span>Save Changes</span></>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

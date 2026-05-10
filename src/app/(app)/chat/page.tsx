'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { MessageCircle, Users, Loader2, Clock } from 'lucide-react'
import { getGradientFromName } from '@/utils/gradient'
import { supabase } from '@/lib/supabase'

// ── Types returned by the two RPCs (via API routes) ──────────────────────────

interface GroupChatItem {
  group_id: string
  group_name: string
  member_count: number
  last_message_text: string | null
  last_message_at: string | null
  last_message_sender_name: string | null
  last_message_type: string | null
  last_message_metadata: { passageRef?: string } | null
  unread_count: number
}

interface DMThread {
  thread_id: string
  other_user_id: string
  other_user_name: string | null
  other_user_avatar: string | null
  last_message_text: string | null
  last_message_at: string | null
  last_message_sender_id: string | null
  unread_count: number
  updated_at: string
}

function getGroupMessagePreview(group: GroupChatItem): string {
  if (!group.last_message_text) return 'No messages yet'
  if (group.last_message_type === 'devotion_share') {
    // WHY: devotion shares store the passage reference in metadata. We restore
    // the original formatted preview rather than showing raw message content.
    return group.last_message_metadata?.passageRef
      ? `📖 Shared ${group.last_message_metadata.passageRef}`
      : '📖 Shared a devotion'
  }
  return group.last_message_text.length > 50
    ? group.last_message_text.substring(0, 50) + '…'
    : group.last_message_text
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [groups, setGroups] = useState<GroupChatItem[]>([])
  const [dmThreads, setDmThreads] = useState<DMThread[]>([])
  const [activeTab, setActiveTab] = useState<'groups' | 'dms'>('groups')
  const [loading, setLoading] = useState(true)

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    }
  }

  const loadGroups = useCallback(async () => {
    if (!user?.id) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/chat/group-list', { headers })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups ?? [])
      }
    } catch (err) {
      console.error('Error loading group list:', err)
    }
  }, [user?.id])

  const loadDMThreads = useCallback(async () => {
    if (!user?.id) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/chat/dm/threads', { headers, credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDmThreads(data.threads ?? [])
      }
    } catch (err) {
      console.error('Error loading DM threads:', err)
    }
  }, [user?.id])

  const loadAll = useCallback(async () => {
    await Promise.all([loadGroups(), loadDMThreads()])
  }, [loadGroups, loadDMThreads])

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    loadAll().finally(() => setLoading(false))

    // WHY polling instead of Realtime: subscribing to inserts across all of the
    // user's groups and DM threads from the list page requires one channel per
    // thread, which gets expensive. 30 s polling is a good-enough MVP.
    // TODO: replace with a single Supabase Realtime broadcast channel that the
    // server pushes to when a new message is inserted for this user.
    const interval = setInterval(loadAll, 30_000)
    return () => clearInterval(interval)
  }, [user?.id, loadAll])

  const formatMessageTime = (dateString: string) => {
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

  const handleGroupClick = (groupId: string) => {
    // WHY optimistic clear: the mark-as-read fires on the chat page mount,
    // but there's a brief window where the user has navigated but the list
    // hasn't refreshed yet. Zeroing the count immediately feels instant.
    setGroups(prev =>
      prev.map(g => g.group_id === groupId ? { ...g, unread_count: 0 } : g)
    )
    router.push(`/chat/${groupId}`)
  }

  const handleDMClick = (threadId: string) => {
    setDmThreads(prev =>
      prev.map(t => t.thread_id === threadId ? { ...t, unread_count: 0 } : t)
    )
    router.push(`/chat/dm/${threadId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading chats...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-50 mb-2">Chats</h1>

          {/* Tabs */}
          <div className="flex space-x-2 mt-4 bg-navy-800/30 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'groups'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Groups ({groups.length})
            </button>
            <button
              onClick={() => setActiveTab('dms')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dms'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Messages ({dmThreads.length})
            </button>
          </div>
        </div>

        {/* Groups List */}
        {activeTab === 'groups' && (
          <>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-navy-800/40 border border-gold-500/20 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-gold-500/50" />
                </div>
                <h3 className="text-lg font-semibold text-slate-50 mb-2">No groups yet</h3>
                <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
                  Join a fellowship group to start chatting with members.
                </p>
                <button
                  onClick={() => router.push('/fellowship')}
                  className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg font-medium transition-colors"
                >
                  Browse Groups
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.group_id}
                    onClick={() => handleGroupClick(group.group_id)}
                    className="w-full bg-navy-900/40 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 hover:bg-navy-800/50 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl ${getGradientFromName(group.group_name)} flex items-center justify-center text-lg font-bold text-slate-50 flex-shrink-0 shadow-sm`}>
                        {group.group_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-slate-50 truncate">{group.group_name}</h3>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {group.last_message_at && (
                              <span className="text-xs text-slate-400 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatMessageTime(group.last_message_at)}</span>
                              </span>
                            )}
                            {group.unread_count > 0 && (
                              <div className="bg-gold-500 text-navy-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {group.unread_count > 9 ? '9+' : group.unread_count}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-400 truncate flex-1 mr-2">
                            {getGroupMessagePreview(group)}
                          </p>
                          {group.member_count > 0 && (
                            <div className="flex items-center space-x-1 text-xs text-slate-500 flex-shrink-0">
                              <Users className="w-3 h-3" />
                              <span>{group.member_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* DM Threads List */}
        {activeTab === 'dms' && (
          <>
            {dmThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-navy-800/40 border border-gold-500/20 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-gold-500/50" />
                </div>
                <h3 className="text-lg font-semibold text-slate-50 mb-2">No messages yet</h3>
                <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
                  Connect with people to start direct messaging.
                </p>
                <button
                  onClick={() => router.push('/discover')}
                  className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg font-medium transition-colors"
                >
                  Discover People
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dmThreads.map((thread) => (
                  <button
                    key={thread.thread_id}
                    onClick={() => handleDMClick(thread.thread_id)}
                    className="w-full bg-navy-900/40 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 hover:bg-navy-800/50 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      {thread.other_user_avatar ? (
                        <img
                          src={thread.other_user_avatar}
                          alt={thread.other_user_name ?? 'User'}
                          className="w-12 h-12 rounded-full border border-gold-500/30 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center border border-gold-500/30 flex-shrink-0">
                          <span className="text-lg font-bold text-gold-500">
                            {(thread.other_user_name ?? 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-slate-50 truncate">{thread.other_user_name ?? 'Unknown User'}</h3>
                          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            {thread.last_message_at && (
                              <span className="text-xs text-slate-400 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatMessageTime(thread.last_message_at)}</span>
                              </span>
                            )}
                            {thread.unread_count > 0 && (
                              <div className="bg-gold-500 text-navy-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {thread.unread_count > 9 ? '9+' : thread.unread_count}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {thread.last_message_text
                            ? (thread.last_message_sender_id === user?.id ? 'You: ' : '') +
                              (thread.last_message_text.length > 50
                                ? thread.last_message_text.substring(0, 50) + '…'
                                : thread.last_message_text)
                            : 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

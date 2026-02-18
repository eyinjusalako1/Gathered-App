'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { FellowshipService } from '@/lib/fellowship-service'
import { FellowshipGroup, GroupChatMessage } from '@/types'
import { MessageCircle, Users, Loader2, MapPin, Clock } from 'lucide-react'
import { getGradientFromName } from '@/utils/gradient'
import { supabase } from '@/lib/supabase'

interface GroupWithLastMessage extends FellowshipGroup {
  lastMessage?: GroupChatMessage | null
  unreadCount?: number
}

interface DMThread {
  id: string
  otherUser: {
    id: string
    name: string
    avatar_url: string | null
  }
  lastMessage: {
    content: string
    created_at: string
    user_id: string
  } | null
  updated_at: string
}

export default function ChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [groups, setGroups] = useState<GroupWithLastMessage[]>([])
  const [dmThreads, setDmThreads] = useState<DMThread[]>([])
  const [activeTab, setActiveTab] = useState<'groups' | 'dms'>('groups')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadGroups()
      loadDMThreads()
    }
  }, [user?.id])

  // Load unread counts from localStorage
  const getUnreadCount = (groupId: string): number => {
    if (typeof window === 'undefined') return 0
    const key = `chat_unread_${groupId}`
    const stored = localStorage.getItem(key)
    return stored ? parseInt(stored, 10) : 0
  }

  // Clear unread count when viewing a group
  const clearUnreadCount = (groupId: string) => {
    if (typeof window === 'undefined') return
    const key = `chat_unread_${groupId}`
    localStorage.removeItem(key)
    // Update state
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, unreadCount: 0 } : g
    ))
  }

  const loadGroups = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const userGroups = await FellowshipService.getUserJoinedGroups(user.id)
      
      // Fetch last message for each group
      const groupsWithMessages = await Promise.all(
        userGroups.map(async (group) => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`/api/chat/group/${group.id}`, {
              headers: {
                'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
              },
            })
            
            let lastMessage: GroupChatMessage | null = null
            if (response.ok) {
              const data = await response.json()
              const messages = data.messages || []
              if (messages.length > 0) {
                // Get the last message (messages are ordered by created_at ascending)
                lastMessage = messages[messages.length - 1]
              }
            }
            
            const unreadCount = getUnreadCount(group.id)
            
            return {
              ...group,
              lastMessage,
              unreadCount,
            }
          } catch (error) {
            console.error(`Error loading last message for group ${group.id}:`, error)
            return {
              ...group,
              lastMessage: null,
              unreadCount: getUnreadCount(group.id),
            }
          }
        })
      )
      
      setGroups(groupsWithMessages)
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const getMessagePreview = (message: GroupChatMessage | null | undefined): string => {
    if (!message) return 'No messages yet'
    if (message.type === 'devotion_share') {
      return message.metadata?.passageRef 
        ? `📖 Shared ${message.metadata.passageRef}`
        : '📖 Shared a devotion'
    }
    return message.content.length > 50 
      ? message.content.substring(0, 50) + '...'
      : message.content
  }

  const loadDMThreads = async () => {
    if (!user?.id) return
    
    try {
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) return

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Get DM threads from API
      const response = await fetch('/api/chat/dm/threads', {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error loading DM threads:', errorData)
        setDmThreads([])
        return
      }

      const data = await response.json()
      setDmThreads(data.threads || [])
    } catch (error) {
      console.error('Error loading DM threads:', error)
      setDmThreads([])
    }
  }

  const handleGroupClick = (groupId: string) => {
    clearUnreadCount(groupId)
    router.push(`/chat/${groupId}`)
  }

  const handleDMClick = (threadId: string) => {
    router.push(`/chat/dm/${threadId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading groups...</p>
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
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className="w-full bg-navy-900/40 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 hover:bg-navy-800/50 transition-all text-left group"
              >
                <div className="flex items-center space-x-3">
                  {/* Group Avatar with gradient */}
                  <div className={`w-12 h-12 rounded-xl ${getGradientFromName(group.name)} flex items-center justify-center text-lg font-bold text-slate-50 flex-shrink-0 shadow-sm`}>
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-slate-50 truncate">{group.name}</h3>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {group.lastMessage && (
                          <span className="text-xs text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatMessageTime(group.lastMessage.created_at)}</span>
                          </span>
                        )}
                        {group.unreadCount && group.unreadCount > 0 && (
                          <div className="bg-gold-500 text-navy-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {group.unreadCount > 9 ? '9+' : group.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400 truncate flex-1 mr-2">
                        {getMessagePreview(group.lastMessage)}
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
                    key={thread.id}
                    onClick={() => handleDMClick(thread.id)}
                    className="w-full bg-navy-900/40 border border-white/10 rounded-xl p-4 hover:border-gold-500/30 hover:bg-navy-800/50 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      {thread.otherUser.avatar_url ? (
                        <img
                          src={thread.otherUser.avatar_url}
                          alt={thread.otherUser.name}
                          className="w-12 h-12 rounded-full border border-gold-500/30 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center border border-gold-500/30 flex-shrink-0">
                          <span className="text-lg font-bold text-gold-500">
                            {thread.otherUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-slate-50 truncate">{thread.otherUser.name}</h3>
                          {thread.lastMessage && (
                            <span className="text-xs text-slate-400 flex items-center space-x-1 flex-shrink-0 ml-2">
                              <Clock className="w-3 h-3" />
                              <span>{formatMessageTime(thread.lastMessage.created_at)}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {thread.lastMessage 
                            ? (thread.lastMessage.content.length > 50 
                                ? thread.lastMessage.content.substring(0, 50) + '...'
                                : thread.lastMessage.content)
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


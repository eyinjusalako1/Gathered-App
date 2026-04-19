'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import { FellowshipGroup, GroupChatMessage } from '@/types'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { Send, Users, Loader2, BookOpen, ArrowRight, Wifi, WifiOff, CornerUpLeft, X, Pencil, Check } from 'lucide-react'
import { Skeleton, SkeletonText, SkeletonAvatar } from '@/components/ui/Skeleton'
import UserProfileModal from '@/components/UserProfileModal'

const getInitials = (name: string): string => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name[0].toUpperCase()
}

interface GroupChatPageProps {
  params: Promise<{ groupId: string }>
}

export default function GroupChatPage({ params }: GroupChatPageProps) {
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  const [groupId, setGroupId] = useState<string>('')
  const [group, setGroup] = useState<FellowshipGroup | null>(null)
  const [messages, setMessages] = useState<GroupChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<GroupChatMessage | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Resolve params
  useEffect(() => {
    Promise.resolve(params).then(p => setGroupId(p?.groupId || '')).catch(console.error)
  }, [params])

  useEffect(() => {
    if (!groupId) return
    loadGroup()
    loadMessages()

    const channel = supabase
      .channel(`group_chat:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_chat_messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const raw = payload.new as any
          let senderName = 'Member'
          let senderAvatar: string | null = null
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('name, avatar_url')
              .eq('id', raw.user_id)
              .single()
            if (profile?.name) senderName = profile.name
            if (profile?.avatar_url) senderAvatar = profile.avatar_url
          } catch { /* keep defaults */ }

          const newMessage: GroupChatMessage = {
            id: raw.id,
            group_id: raw.group_id,
            user_id: raw.user_id,
            content: raw.content,
            type: raw.type || 'text',
            metadata: raw.metadata,
            created_at: raw.created_at,
            user: { id: raw.user_id, name: senderName, avatar_url: senderAvatar },
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('disconnected')
        else setRealtimeStatus('connecting')
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadGroup = async () => {
    if (!groupId) return
    try {
      const groupData = await FellowshipService.getGroup(groupId)
      setGroup(groupData)
    } catch (error) {
      console.error('Error loading group:', error)
    }
  }

  const loadMessages = async (showLoading = true) => {
    if (!groupId || !user?.id) return
    try {
      if (showLoading) setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`/api/chat/group/${groupId}`, {
        headers: {
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: 'Access Denied', description: 'You must be a member of this group to view messages.', variant: 'error', duration: 3000 })
          router.push('/chat')
          return
        }
        throw new Error('Failed to load messages')
      }

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      if (showLoading) {
        toast({ title: 'Error', description: 'Failed to load messages.', variant: 'error', duration: 3000 })
      }
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !groupId || sending || !user?.id) return
    setSending(true)
    const optimisticContent = messageInput.trim()
    const optimisticReply = replyingTo
    setMessageInput('')
    setReplyingTo(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const metadata = optimisticReply
        ? { reply_to: { id: optimisticReply.id, content: optimisticReply.content.slice(0, 120), sender_name: optimisticReply.user.name } }
        : null
      const response = await fetch(`/api/chat/group/${groupId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ content: optimisticContent, type: 'text', metadata }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: 'Access Denied', description: 'You must be a member of this group to send messages.', variant: 'error', duration: 3000 })
        } else {
          throw new Error('Failed to send message')
        }
        setMessageInput(optimisticContent)
        setReplyingTo(optimisticReply)
        return
      }

      const data = await response.json()
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev
        return [...prev, data.message]
      })
    } catch (error) {
      console.error('Error sending message:', error)
      setMessageInput(optimisticContent)
      setReplyingTo(optimisticReply)
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'error', duration: 3000 })
    } finally {
      setSending(false)
    }
  }

  const startLongPress = (message: GroupChatMessage) => {
    pressTimerRef.current = setTimeout(() => {
      setReplyingTo(message)
      setTimeout(() => inputRef.current?.focus(), 50)
    }, 400)
  }

  const cancelLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchStart = (message: GroupChatMessage, e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    pressTimerRef.current = setTimeout(() => {
      setReplyingTo(message)
      setTimeout(() => inputRef.current?.focus(), 50)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pressTimerRef.current || !touchStartPosRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartPosRef.current.x
    const dy = touch.clientY - touchStartPosRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchEnd = () => {
    touchStartPosRef.current = null
    cancelLongPress()
  }

  const startEdit = (message: GroupChatMessage) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setEditContent('')
  }

  const handleEditSave = async (messageId: string) => {
    if (!editContent.trim() || editSaving) return
    setEditSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/chat/group/${groupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ messageId, content: editContent.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: data.message.content, edited_at: data.message.edited_at, metadata: data.message.metadata } : m))
        cancelEdit()
      }
    } catch { /* ignore */ } finally {
      setEditSaving(false)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, 100)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const isMyMessage = (message: GroupChatMessage) => message.user_id === user?.id

  if (loading && messages.length === 0) {
    return (
      <div className="bg-navy-900 flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - env(safe-area-inset-top))' }}>
        {/* Header skeleton */}
        <div className="bg-navy-800/50 border-b border-white/10 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <Skeleton className="h-4 w-12 rounded" />
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {/* Message bubbles skeleton */}
        <div className="flex-1 px-4 py-4 space-y-4 overflow-hidden">
          {/* Other user message */}
          <div className="flex items-end gap-2 max-w-xs">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-12 w-48 rounded-2xl rounded-bl-sm" />
          </div>
          {/* Own message */}
          <div className="flex items-end gap-2 max-w-xs ml-auto flex-row-reverse">
            <Skeleton className="h-10 w-40 rounded-2xl rounded-br-sm" />
          </div>
          {/* Other user */}
          <div className="flex items-end gap-2 max-w-xs">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-16 w-56 rounded-2xl rounded-bl-sm" />
          </div>
          {/* Own message */}
          <div className="flex items-end gap-2 max-w-xs ml-auto flex-row-reverse">
            <Skeleton className="h-10 w-32 rounded-2xl rounded-br-sm" />
          </div>
          {/* Other user */}
          <div className="flex items-end gap-2 max-w-xs">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-10 w-44 rounded-2xl rounded-bl-sm" />
          </div>
        </div>
        {/* Input skeleton */}
        <div className="border-t border-white/10 bg-navy-800/50 px-4 py-3">
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-navy-900 flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="bg-navy-800/50 border-b border-white/10 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-50 transition-colors">
              ← Back
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">{group?.name || 'Group Chat'}</h1>
              {group && (
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>{group.member_count} members</span>
                </div>
              )}
            </div>
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {realtimeStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-emerald-400" title="Live updates active">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live</span>
              </span>
            ) : realtimeStatus === 'connecting' ? (
              <span className="flex items-center gap-1 text-amber-400" title="Connecting…">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Connecting</span>
              </span>
            ) : (
              <button
                onClick={() => loadMessages(false)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Disconnected — tap to refresh"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-navy-800/40 border border-gold-500/20 rounded-full flex items-center justify-center mb-4">
                <Send className="w-8 h-8 text-gold-500/50" />
              </div>
              <h3 className="text-lg font-semibold text-slate-50 mb-2">No messages yet</h3>
              <p className="text-slate-400 text-sm text-center max-w-sm mb-4">Be the first to say hello 👋 — share a thought, verse, or prayer.</p>
              <button
                onClick={() => router.push('/devotions')}
                className="flex items-center space-x-2 bg-gold-500/10 border border-gold-600/40 text-gold-500 hover:bg-gold-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Share today&apos;s devotion</span>
              </button>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = isMyMessage(message)
              const isDevotionShare = message.type === 'devotion_share'
              const replyTo = message.metadata?.reply_to

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4 group`}
                  onMouseDown={() => startLongPress(message)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={(e) => handleTouchStart(message, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onContextMenu={(e) => { e.preventDefault(); setReplyingTo(message); setTimeout(() => inputRef.current?.focus(), 50) }}
                >
                  <div className={`flex items-end space-x-2 max-w-[75%] ${isMine ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!isMine && (
                      <div className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0 mb-1">
                        {message.user.avatar_url ? (
                          <img src={message.user.avatar_url} alt={message.user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-gold-500">{getInitials(message.user.name)}</span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {isDevotionShare ? (
                        <div className="bg-navy-800/40 border border-gold-600/30 rounded-xl p-4 space-y-3 max-w-md">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-5 h-5 text-gold-500" />
                            <h4 className="text-sm font-semibold text-slate-50">📖 Devotion shared</h4>
                          </div>
                          {message.metadata?.passageRef && (
                            <div className="bg-navy-900/60 rounded-lg p-3 border border-white/5">
                              <p className="text-sm font-medium text-gold-500 mb-1">{message.metadata.passageRef}</p>
                            </div>
                          )}
                          {message.metadata?.reflection && (
                            <div className="bg-navy-900/60 rounded-lg p-3 border border-white/5">
                              <p className="text-xs text-slate-400 mb-1">Reflection:</p>
                              <p className="text-sm text-slate-200 whitespace-pre-wrap line-clamp-3">{message.metadata.reflection}</p>
                            </div>
                          )}
                          {!message.metadata?.passageRef && (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{message.content}</p>
                          )}
                          <button
                            onClick={() => router.push('/devotions')}
                            className="w-full flex items-center justify-center space-x-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            <span>Open Devotions</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className={`rounded-2xl px-4 py-3 ${isMine ? 'bg-navy-900/60 border border-gold-600/30' : 'bg-navy-900/40 border border-white/10'} text-slate-50`}>
                          {/* Quoted reply preview */}
                          {replyTo && (
                            <div className={`border-l-2 border-gold-500/60 pl-2 mb-2 rounded-sm ${isMine ? 'bg-navy-800/40' : 'bg-navy-800/30'} py-1 pr-2`}>
                              <p className="text-xs font-semibold text-gold-400 truncate">{replyTo.sender_name}</p>
                              <p className="text-xs text-slate-400 truncate">{replyTo.content}</p>
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedUserId(message.user_id)}
                            className="text-xs font-semibold mb-1.5 text-gold-500 hover:text-gold-400 transition-colors block text-left"
                          >
                            {message.user.name}
                          </button>
                          {editingMessageId === message.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(message.id) }
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                className="w-full bg-navy-800/60 border border-gold-500/40 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder-slate-400 focus:outline-none focus:border-gold-500 resize-none"
                                rows={Math.min(6, editContent.split('\n').length + 1)}
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditSave(message.id)}
                                  disabled={editSaving || !editContent.trim()}
                                  className="flex items-center gap-1 px-3 py-1 bg-gold-500 text-navy-900 rounded-lg text-xs font-semibold disabled:opacity-50"
                                >
                                  {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Save
                                </button>
                                <button onClick={cancelEdit} className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                          )}
                        </div>
                      )}
                      <div className={`flex items-center gap-2 mt-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {message.edited_at && (
                          <span className="text-[10px] text-slate-500 italic">edited</span>
                        )}
                        <span className="text-xs text-slate-400/60">{formatTime(message.created_at)}</span>
                        {isMine && !isDevotionShare && editingMessageId !== message.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelLongPress(); startEdit(message) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-gold-400 p-0.5 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelLongPress(); setReplyingTo(message); setTimeout(() => inputRef.current?.focus(), 50) }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-gold-400 p-0.5 rounded"
                          title="Reply"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="bg-navy-800/80 border-t border-gold-500/20 px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <CornerUpLeft className="w-4 h-4 text-gold-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gold-400">{replyingTo.user.name}</p>
            <p className="text-xs text-slate-400 truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="bg-navy-800/50 border-t border-white/10 px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
            }}
            placeholder={replyingTo ? `Reply to ${replyingTo.user.name}…` : 'Type a message…'}
            className="flex-1 px-4 py-2 bg-navy-900/60 border border-white/10 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || sending}
            className="bg-gold-500 hover:bg-gold-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-navy-900 p-2 rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

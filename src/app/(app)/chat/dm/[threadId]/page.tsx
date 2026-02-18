'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { Send, Loader2, MessageSquare, ArrowLeft, MapPin, Sparkles, BookOpen, Flag, UserX } from 'lucide-react'
import ReportModal from '@/components/ReportModal'

interface DMMessage {
  id: string
  thread_id: string
  user_id: string
  content: string
  created_at: string
  type?: 'text' | 'devotion_share'
  metadata?: {
    passageRef?: string
    reflection?: string
  }
  sender: {
    id: string
    name: string
    avatar_url: string | null
  }
}

interface DMChatPageProps {
  params: Promise<{ threadId: string }> | { threadId: string }
}

// Helper function to get initials from name
const getInitials = (name: string): string => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name[0].toUpperCase()
}

export default function DMChatPage({ params }: DMChatPageProps) {
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  const [threadId, setThreadId] = useState<string>('')
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; avatar_url: string | null; city: string | null } | null>(null)
  const [messages, setMessages] = useState<DMMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [blockDirection, setBlockDirection] = useState<'none' | 'blocked' | 'blocked_by'>('none')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Softer icebreaker prompts (rotating)
  const allIcebreakers = [
    "What brought you to Gathered?",
    "How did you find this group?",
    "Anything we can pray for this week?",
    "What's been encouraging you lately?"
  ]
  
  // Show 1-2 random icebreakers (memoized)
  const [icebreakers] = useState<string[]>(() => {
    const shuffled = [...allIcebreakers].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 2)
  })

  // Devotion share quick replies
  const devotionQuickReplies = [
    { text: "Amen 🙏", label: "Amen" },
    { text: "This really spoke to me...", label: "Reflect" },
    { text: "Let's discuss this...", label: "Discuss" }
  ]

  // Resolve params
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolvedParams = params instanceof Promise ? await params : params
        const id = resolvedParams?.threadId || ''
        setThreadId(id)
      } catch (error) {
        console.error('Error resolving params:', error)
      }
    }
    resolveParams()
  }, [params])

  // Load messages and other user info
  useEffect(() => {
    if (threadId && user) {
      loadMessages()
      loadOtherUser()
      void loadBlockStatus()
      // Start polling for new messages every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        loadMessages(false) // Silent refresh
      }, 5000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [threadId, user])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  // Auto-scroll on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }, 100)
    }
  }, [loading])

  const loadOtherUser = async () => {
    if (!threadId || !user) return
    
    // Other user info will be extracted from messages
    // This is a fallback - we'll get it from the first message
  }

  const loadBlockStatus = async () => {
    if (!otherUser?.id) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch(`/api/safety/block?user_id=${otherUser.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!response.ok) return
      const data = await response.json()
      setBlockDirection(data.direction || 'none')
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadBlockStatus()
  }, [otherUser?.id])

  const loadMessages = async (showLoading = true) => {
    if (!threadId) return

    if (showLoading) {
      setLoading(true)
    }

    try {
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please log in to view messages')
      }

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/chat/dm/${threadId}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403 && errorData?.error?.toLowerCase?.().includes('blocked')) {
          setBlockDirection('blocked_by')
        }
        throw new Error(errorData.error || 'Failed to load messages')
      }

      const data = await response.json()
      setMessages(data.messages || [])

      // Set other user info from API response
      if (data.otherUser) {
        setOtherUser(data.otherUser)
      } else if (!otherUser && data.messages && data.messages.length > 0) {
        // Fallback: extract from messages if API didn't return otherUser
        const otherMessage = data.messages.find((m: DMMessage) => m.user_id !== user?.id)
        if (otherMessage) {
          setOtherUser(otherMessage.sender)
        }
      }
    } catch (error: any) {
      console.error('Error loading messages:', error)
      if (showLoading) {
        toast({ title: 'Failed to load messages', description: error.message, variant: 'error' })
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !threadId || sending) return
    if (blockDirection !== 'none') {
      toast({ title: 'You cannot message this user', variant: 'error' })
      return
    }

    setSending(true)
    try {
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please log in to send messages')
      }

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/chat/dm/${threadId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ content: messageInput.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()
      
      // Add message to local state
      setMessages(prev => [...prev, data.message])
      setMessageInput('')
      
      // Reset textarea height
      if (messageInputRef.current) {
        messageInputRef.current.style.height = 'auto'
      }
      
      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast({ title: 'Failed to send message', description: error.message, variant: 'error' })
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleBlockToggle = async () => {
    if (!otherUser?.id || blockLoading) return
    const isBlocking = blockDirection === 'blocked'
    const confirmText = isBlocking
      ? `Unblock ${otherUser.name}?`
      : `Block ${otherUser.name}? They won't be able to message you.`
    if (!window.confirm(confirmText)) return

    setBlockLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Please log in')
      }
      const response = await fetch('/api/safety/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          blocked_user_id: otherUser.id,
          action: isBlocking ? 'unblock' : 'block',
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update block')
      }
      setBlockDirection(isBlocking ? 'none' : 'blocked')
      toast({ title: isBlocking ? 'User unblocked' : 'User blocked', variant: 'success' })
    } catch (error: any) {
      toast({ title: 'Failed to update block', description: error.message, variant: 'error' })
    } finally {
      setBlockLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <p className="text-slate-400">Please log in to view messages</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-navy-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-navy-800/50 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 flex-1 justify-center">
              {otherUser?.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt={otherUser.name}
                  className="w-10 h-10 rounded-full border-2 border-gold-500/30"
                />
              ) : (
                <div className="w-10 h-10 bg-gold-500/20 rounded-full flex items-center justify-center border-2 border-gold-500/30">
                  <span className="text-sm font-bold text-gold-500">
                    {getInitials(otherUser?.name || 'U')}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-white">{otherUser?.name || 'Direct Message'}</h1>
                {otherUser?.city && (
                  <div className="flex items-center space-x-1 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span>{otherUser.city}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReportOpen(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
                aria-label="Report user"
              >
                <Flag className="w-4 h-4" />
              </button>
              <button
                onClick={handleBlockToggle}
                disabled={blockLoading || !otherUser}
                className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5 disabled:opacity-60"
                aria-label="Block user"
              >
                <UserX className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {blockDirection !== 'none' && (
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="rounded-2xl border border-gold-500/30 bg-navy-800/50 px-4 py-3 text-sm text-gold-100">
            {blockDirection === 'blocked'
              ? "You've blocked this user. Unblock to continue the conversation."
              : 'This conversation is unavailable because one of you is blocked.'}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="mb-6">
              <Sparkles className="w-16 h-16 text-gold-500/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                This is the start of something good ✨
              </h3>
              <p className="text-slate-400 mb-6">Say hello or share today's devotion</p>
              <button
                onClick={() => {
                  setMessageInput("Hey! 👋")
                  setTimeout(() => {
                    messageInputRef.current?.focus()
                  }, 0)
                }}
                className="px-4 py-2 bg-gold-500/20 border border-gold-500/40 rounded-full text-sm text-gold-400 hover:bg-gold-500/30 transition-colors"
              >
                Say hello
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const isOwnMessage = message.user_id === user.id
              const prevMessage = index > 0 ? messages[index - 1] : null
              const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
              
              // Group messages from same sender if within 2 minutes
              const isGrouped = prevMessage && 
                prevMessage.user_id === message.user_id &&
                (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 120000
              
              const showAvatar = !isOwnMessage && !isGrouped
              const showName = !isOwnMessage && !isGrouped
              
              // Show timestamp if gap > 5 minutes or first message
              const showTimestamp = !prevMessage || 
                (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) > 300000
              
              const isDevotionShare = message.type === 'devotion_share'
              
              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-slate-500 bg-navy-800/50 px-3 py-1 rounded-full">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-2'}`}>
                    <div className={`flex items-end space-x-2 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar - only show when not grouped */}
                      {!isOwnMessage && (
                        <div className={`flex-shrink-0 ${showAvatar ? 'w-8' : 'w-8 opacity-0 pointer-events-none'}`}>
                          {showAvatar && (
                            message.sender.avatar_url ? (
                              <img
                                src={message.sender.avatar_url}
                                alt={message.sender.name}
                                className="w-8 h-8 rounded-full border border-gold-500/30"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gold-500/20 rounded-full flex items-center justify-center border border-gold-500/30">
                                <span className="text-xs font-bold text-gold-500">
                                  {getInitials(message.sender.name)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-full`}>
                        {showName && (
                          <span className="text-xs text-slate-400 mb-0.5 px-2">
                            {message.sender.name}
                          </span>
                        )}
                        
                        {/* Devotion Share Card */}
                        {isDevotionShare ? (
                          <div className="bg-navy-800/70 border border-gold-500/40 rounded-2xl p-4 max-w-full">
                            <div className="flex items-center space-x-2 mb-2">
                              <BookOpen className="w-4 h-4 text-gold-500" />
                              <span className="text-xs font-semibold text-gold-400">Devotion shared</span>
                            </div>
                            {message.metadata?.passageRef && (
                              <p className="text-sm font-medium text-white mb-2">
                                {message.metadata.passageRef}
                              </p>
                            )}
                            {message.content && (
                              <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                                {message.content}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {devotionQuickReplies.map((reply, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setMessageInput(reply.text)
                                    setTimeout(() => {
                                      messageInputRef.current?.focus()
                                      messageInputRef.current?.setSelectionRange(reply.text.length, reply.text.length)
                                    }, 0)
                                  }}
                                  className="px-3 py-1.5 bg-navy-900/50 border border-gold-500/30 rounded-lg text-xs text-gold-400 hover:bg-gold-500/20 transition-colors"
                                >
                                  {reply.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-2xl px-4 py-2.5 max-w-full ${
                              isOwnMessage
                                ? 'bg-gold-500 text-navy-900'
                                : 'bg-navy-800/50 text-white border border-gold-500/30'
                            }`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        )}
                        
                        {/* Timestamp - only show on last message in group or standalone */}
                        {(!nextMessage || nextMessage.user_id !== message.user_id || 
                          (new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime()) > 120000) && (
                          <span className={`text-xs text-slate-500 mt-0.5 px-2 ${isOwnMessage ? 'text-right' : ''}`}>
                            {formatTime(message.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Icebreakers (above input, only when no messages or empty input) */}
      {messages.length > 0 && !messageInput && icebreakers.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-2 pb-1">
          <div className="flex flex-wrap gap-2 justify-center">
            {icebreakers.map((prompt, index) => (
              <button
                key={index}
                onClick={() => {
                  setMessageInput(prompt)
                  setTimeout(() => {
                    messageInputRef.current?.focus()
                    messageInputRef.current?.setSelectionRange(prompt.length, prompt.length)
                  }, 0)
                }}
                className="px-3 py-1.5 bg-navy-800/30 border border-gold-500/20 rounded-full text-xs text-slate-300 hover:bg-navy-800/50 hover:border-gold-500/30 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar (Fixed to bottom) */}
      <div className="bg-navy-800/95 backdrop-blur-md border-t border-white/10 flex-shrink-0">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-end space-x-2">
            <textarea
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value)
                // Auto-resize textarea (max 4 lines)
                e.target.style.height = 'auto'
                const maxHeight = 4 * 24 // 4 lines * line-height
                e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={blockDirection === 'none' ? "Type a message..." : "Messaging is unavailable"}
              rows={1}
              className="flex-1 bg-navy-900/70 border border-gold-500/30 rounded-2xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-gold-500 resize-none overflow-y-auto text-sm leading-6"
              style={{ maxHeight: '96px' }}
              disabled={sending || blockDirection !== 'none'}
            />
            {messageInput.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={sending || blockDirection !== 'none'}
                className="bg-gold-500 text-navy-900 p-2.5 rounded-2xl hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            ) : (
              <div className="w-[42px] flex-shrink-0"></div> // Spacer to keep layout consistent
            )}
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="user"
        reportedUserId={otherUser?.id || null}
      />
    </div>
  )
}


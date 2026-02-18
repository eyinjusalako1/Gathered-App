'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Users, 
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  MapPin,
  MessageSquare
} from 'lucide-react'

interface Connection {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  other_user: {
    id: string
    name: string
    avatar_url: string | null
    city: string | null
    bio: string | null
    interests: string[]
  }
}

export default function ConnectionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'accepted'>('incoming')
  const [incoming, setIncoming] = useState<Connection[]>([])
  const [outgoing, setOutgoing] = useState<Connection[]>([])
  const [accepted, setAccepted] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadConnections()
    }
  }, [user])

  const loadConnections = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Get session token for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Please log in to view connections')
      }

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/connections/list', {
        headers,
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load connections')
      }
      const data = await response.json()
      setIncoming(data.incoming || [])
      setOutgoing(data.outgoing || [])
      setAccepted(data.accepted || [])
    } catch (error: any) {
      console.error('Error loading connections:', error)
      toast({ title: error.message || 'Failed to load connections', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (connectionId: string, action: 'accept' | 'reject') => {
    setActionLoading(connectionId)
    try {
      // Get session token for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        toast({ title: 'Please log in to respond', variant: 'error' })
        return
      }

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers,
        body: JSON.stringify({ connectionId, action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to respond to connection')
      }

      if (action === 'accept' && data.threadId) {
        toast({ title: "You're connected 🎉 Say hi!", variant: 'success' })
        // Redirect to DM thread
        router.push(`/chat/dm/${data.threadId}`)
      } else {
        toast({ title: `Connection request ${action}ed`, variant: 'success' })
        await loadConnections()
      }
    } catch (error: any) {
      console.error('Error responding to connection:', error)
      toast({ title: error.message || 'Failed to respond to connection', variant: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleMessage = async (otherUserId: string, connectionId?: string) => {
    if (connectionId) {
      setActionLoading(connectionId)
    }
    
    try {
      // Get session token for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        toast({ title: 'Please log in to message', variant: 'error' })
        return
      }

      const token = session.access_token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Get or create DM thread
      const response = await fetch('/api/chat/dm/get-or-create', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ otherUserId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to open chat')
      }

      const data = await response.json()
      
      // Navigate to DM thread
      router.push(`/chat/dm/${data.threadId}`)
    } catch (error: any) {
      console.error('Error opening chat:', error)
      toast({ title: error.message || 'Failed to open chat', variant: 'error' })
    } finally {
      if (connectionId) {
        setActionLoading(null)
      }
    }
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getCurrentList = () => {
    switch (activeTab) {
      case 'incoming':
        return incoming
      case 'outgoing':
        return outgoing
      case 'accepted':
        return accepted
      default:
        return []
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      {/* Header */}
      <div className="bg-navy-800/50 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-slate-400 hover:text-slate-50 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-white">Connections</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex space-x-2 mb-6 bg-navy-800/30 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'incoming'
                ? 'bg-gold-500 text-navy-900'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Incoming ({incoming.length})
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'outgoing'
                ? 'bg-gold-500 text-navy-900'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Sent ({outgoing.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'accepted'
                ? 'bg-gold-500 text-navy-900'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Friends ({accepted.length})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
          </div>
        )}

        {/* Connection List */}
        {!loading && (
          <div className="space-y-4">
            {getCurrentList().length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {activeTab === 'incoming' && 'No incoming requests'}
                  {activeTab === 'outgoing' && 'No sent requests'}
                  {activeTab === 'accepted' && 'No connections yet'}
                </h3>
                <p className="text-slate-400">
                  {activeTab === 'incoming' && 'You don\'t have any pending connection requests'}
                  {activeTab === 'outgoing' && 'You haven\'t sent any connection requests'}
                  {activeTab === 'accepted' && 'Start connecting with people to see them here'}
                </p>
              </div>
            ) : (
              getCurrentList().map((connection) => (
                <div
                  key={connection.id}
                  className="bg-navy-800/50 border border-gold-500/30 rounded-2xl p-4"
                >
                  <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    {connection.other_user.avatar_url ? (
                      <img
                        src={connection.other_user.avatar_url}
                        alt={connection.other_user.name}
                        className="w-14 h-14 rounded-full border-2 border-gold-500/30"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gold-500/20 rounded-full flex items-center justify-center border-2 border-gold-500/30">
                        <span className="text-lg font-bold text-gold-500">
                          {getInitials(connection.other_user.name)}
                        </span>
                      </div>
                    )}

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-lg mb-1">
                        {connection.other_user.name}
                      </h4>
                      {connection.other_user.city && (
                        <div className="flex items-center space-x-1 text-sm text-slate-400 mb-2">
                          <MapPin className="w-3 h-3" />
                          <span>{connection.other_user.city}</span>
                        </div>
                      )}
                      {connection.other_user.bio && (
                        <p className="text-slate-300 text-sm line-clamp-2 mb-3">
                          {connection.other_user.bio}
                        </p>
                      )}

                      {/* Actions */}
                      {activeTab === 'incoming' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleRespond(connection.id, 'accept')}
                            disabled={actionLoading === connection.id}
                            className="flex-1 bg-gold-500 text-navy-900 py-2 px-4 rounded-lg font-semibold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                          >
                            {actionLoading === connection.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Accept</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRespond(connection.id, 'reject')}
                            disabled={actionLoading === connection.id}
                            className="px-4 py-2 bg-navy-900/50 text-slate-300 rounded-lg font-semibold hover:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gold-500/30"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {activeTab === 'outgoing' && (
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span>Pending</span>
                        </div>
                      )}

                      {activeTab === 'accepted' && (
                        <button
                          onClick={() => handleMessage(connection.other_user.id, connection.id)}
                          disabled={actionLoading === connection.id}
                          className="w-full bg-gold-500 text-navy-900 py-2 px-4 rounded-lg font-semibold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          {actionLoading === connection.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Opening...</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-4 h-4" />
                              <span>Message</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}


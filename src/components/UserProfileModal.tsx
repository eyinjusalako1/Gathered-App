'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { X, UserPlus, Clock, Check, UserCheck } from 'lucide-react'

interface UserProfileModalProps {
  userId: string | null
  onClose: () => void
  /** Optional hints — modal will also fetch fresh data */
  initialName?: string
  initialAvatarUrl?: string | null
}

type FriendshipStatus = 'self' | 'none' | 'pending_sent' | 'pending_received' | 'accepted'

interface PublicProfile {
  id: string
  name: string | null
  avatar_url: string | null
  role: string | null
  city: string | null
  bio: string | null
}

const getInitials = (name: string): string => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name[0].toUpperCase()
}

export default function UserProfileModal({
  userId,
  onClose,
  initialName,
  initialAvatarUrl,
}: UserProfileModalProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('none')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setFriendStatus('none')
      return
    }
    fetchData(userId)
  }, [userId])

  const fetchData = async (uid: string) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : ''

      const [profileRes, friendRes] = await Promise.all([
        fetch(`/api/users/${uid}`, { headers: { Authorization: authHeader } }),
        fetch(`/api/friendships?userId=${uid}`, { headers: { Authorization: authHeader } }),
      ])

      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data.user)
      }
      if (friendRes.ok) {
        const data = await friendRes.json()
        setFriendStatus(data.status as FriendshipStatus)
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false)
    }
  }

  const handleSendRequest = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ addressee_id: userId }),
      })
      if (res.ok || res.status === 409) {
        setFriendStatus('pending_sent')
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false)
    }
  }

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (!userId) return
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/friendships/respond', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ requester_id: userId, action }),
      })
      if (res.ok) {
        setFriendStatus(action === 'accept' ? 'accepted' : 'none')
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false)
    }
  }

  if (!userId) return null

  const displayName = profile?.name || initialName || 'Member'
  const avatarUrl = profile?.avatar_url ?? initialAvatarUrl ?? null
  const isSelf = userId === user?.id

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-navy-900 border border-white/10 rounded-t-2xl p-6 pb-24 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500" />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gold-500/15 border-2 border-gold-500/30 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gold-500">{getInitials(displayName)}</span>
              )}
            </div>

            {/* Name + meta */}
            <div>
              <h2 className="text-xl font-bold text-slate-50">{displayName}</h2>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                {profile?.role && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                    profile.role === 'steward'
                      ? 'bg-gold-500/15 text-gold-500 border-gold-600/30'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {profile.role === 'steward' ? 'Steward' : 'Disciple'}
                  </span>
                )}
                {profile?.city && (
                  <span className="text-xs text-slate-400">{profile.city}</span>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <p className="text-sm text-slate-300 max-w-xs leading-relaxed">{profile.bio}</p>
            )}

            {/* Friendship action */}
            {!isSelf && (
              <div className="w-full pt-2">
                {friendStatus === 'none' && (
                  <button
                    onClick={handleSendRequest}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-navy-900 font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    {actionLoading ? 'Sending…' : 'Add Friend'}
                  </button>
                )}
                {friendStatus === 'pending_sent' && (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 border border-white/15 text-slate-500 px-4 py-2.5 rounded-xl cursor-not-allowed"
                  >
                    <Clock className="w-4 h-4" />
                    Request Sent
                  </button>
                )}
                {friendStatus === 'pending_received' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRespond('decline')}
                      disabled={actionLoading}
                      className="flex-1 border border-white/20 text-slate-300 hover:bg-white/10 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespond('accept')}
                      disabled={actionLoading}
                      className="flex-1 bg-gold-500 hover:bg-gold-600 text-navy-900 font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        {actionLoading ? 'Accepting…' : 'Accept'}
                      </span>
                    </button>
                  </div>
                )}
                {friendStatus === 'accepted' && (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium py-2">
                    <UserCheck className="w-4 h-4" />
                    Friends
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { Users, Lock, Globe, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { getGradientFromName } from '@/utils/gradient'

interface InviteGroup {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  member_count: number
  is_private: boolean
}

interface InviteData {
  id: string
  invite_code: string
  invite_type: 'group' | 'app'
  created_at: string
  group?: InviteGroup
}

export default function InviteLandingPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()

  const [inviteCode, setInviteCode] = useState<string>('')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)

  // Resolve code from params
  useEffect(() => {
    const code = params?.code as string | undefined
    if (code?.trim()) {
      setInviteCode(code.toUpperCase().trim())
    } else if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/invite\/([^/]+)/)
      if (match?.[1]) setInviteCode(match[1].toUpperCase().trim())
      else { setError('Invalid invite link'); setLoading(false) }
    }
  }, [params])

  // Load invite data
  useEffect(() => {
    if (!inviteCode) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/invites/${encodeURIComponent(inviteCode)}`, {
          cache: 'no-store',
        })
        if (res.status === 410) {
          setLimitReached(true)
          setLoading(false)
          return
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load invite')
        }
        const data = await res.json()
        if (!data.invite) throw new Error('Invalid response from server')
        setInvite(data.invite)
      } catch (err: any) {
        setError(err.message || 'Failed to load invite. Please check the link and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [inviteCode])

  const handleAccept = async () => {
    if (!user) {
      router.push(`/auth/login?redirect=/invite/${inviteCode}`)
      return
    }
    setAccepting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/auth/login?redirect=/invite/${inviteCode}`)
        return
      }
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ invite_code: inviteCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Already a member → just navigate there
        if (data.error?.toLowerCase().includes('already')) {
          router.push(invite?.group?.id ? `/fellowship/${invite.group.id}` : '/fellowship')
          return
        }
        throw new Error(data.error || 'Failed to accept invite')
      }
      toast({
        title: invite?.group?.is_private ? 'Request sent!' : 'Welcome!',
        description: invite?.group?.is_private
          ? 'Your join request has been sent to the group admin.'
          : `You've joined ${invite?.group?.name ?? 'the group'}!`,
        variant: 'success',
      })
      router.push(data.redirect_path || '/fellowship')
    } catch (err: any) {
      toast({
        title: 'Could not accept invite',
        description: err.message || 'Please try again',
        variant: 'error',
      })
      setAccepting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading invite…</p>
        </div>
      </div>
    )
  }

  if (limitReached) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-50 mb-2">Invite limit reached</h1>
          <p className="text-slate-400 text-sm mb-6">
            This invite link has reached its maximum number of uses. Ask the group admin for a fresh link.
          </p>
          <button
            onClick={() => router.push('/fellowship')}
            className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-5 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            Browse groups
          </button>
        </div>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-50 mb-2">Invalid invite</h1>
          <p className="text-slate-400 text-sm mb-6">
            {error || 'This invite link is invalid. Please check the link and try again.'}
          </p>
          <button
            onClick={() => router.push(user ? '/fellowship' : '/auth/login')}
            className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-5 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            {user ? 'Browse groups' : 'Sign in'}
          </button>
        </div>
      </div>
    )
  }

  const group = invite.group

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        {/* Wordmark */}
        <p className="text-center text-gold-500 font-bold text-lg tracking-wide mb-2">gathered</p>
        <p className="text-center text-slate-400 text-sm mb-8">You&apos;ve been invited to join a fellowship group</p>

        {/* Group card */}
        {group ? (
          <div className="bg-navy-800/60 border border-white/10 rounded-2xl overflow-hidden mb-6 shadow-xl">
            {/* Gradient banner */}
            <div className="h-24 w-full" style={{ background: getGradientFromName(group.name) }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-50 truncate">{group.name}</h2>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
                    {group.is_private
                      ? <><Lock className="w-3 h-3" /><span>Private group</span></>
                      : <><Globe className="w-3 h-3" /><span>Open group</span></>
                    }
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <Users className="w-4 h-4" />
                  <span>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</span>
                </div>
              </div>
              {group.description && (
                <p className="text-sm text-slate-300 line-clamp-3">{group.description}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-navy-800/60 border border-white/10 rounded-2xl p-6 mb-6 text-center">
            <p className="text-slate-400 text-sm">App invite — join Gathered to get started.</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-4 text-base font-semibold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {accepting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Joining…</span>
            </>
          ) : (
            <>
              <span>
                {!user
                  ? 'Sign in to join'
                  : group?.is_private
                    ? 'Request to Join'
                    : 'Join Group'
                }
              </span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {!user && (
          <p className="text-center text-xs text-slate-500 mt-4">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => router.push(`/auth/signup?redirect=/invite/${inviteCode}`)}
              className="text-gold-500 hover:text-gold-400 underline"
            >
              Sign up free
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { Sparkles, Users, ArrowRight, Loader2 } from 'lucide-react'

interface InviteData {
  id: string
  invite_code: string
  invite_type: 'group' | 'app'
  created_at: string
  group?: {
    id: string
    name: string
    description: string | null
    avatar_url: string | null
  }
}

export default function InviteLandingPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [inviteCode, setInviteCode] = useState<string>('')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve code from params (useParams in client components returns params directly)
  useEffect(() => {
    // Wait a bit for params to be available
    const timer = setTimeout(() => {
      if (!params) {
        // Try getting code from URL as fallback
        if (typeof window !== 'undefined') {
          const pathMatch = window.location.pathname.match(/\/invite\/([^\/]+)/)
          if (pathMatch && pathMatch[1]) {
            setInviteCode(pathMatch[1].toUpperCase().trim())
            return
          }
        }
        setError('Invalid invite link')
        setLoading(false)
        return
      }
      
      const code = params.code as string
      if (code && code.trim()) {
        setInviteCode(code.toUpperCase().trim())
      } else {
        // Fallback: try URL
        if (typeof window !== 'undefined') {
          const pathMatch = window.location.pathname.match(/\/invite\/([^\/]+)/)
          if (pathMatch && pathMatch[1]) {
            setInviteCode(pathMatch[1].toUpperCase().trim())
            return
          }
        }
        setError('Invalid invite code')
        setLoading(false)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [params])

  // Load invite data
  useEffect(() => {
    if (!inviteCode) {
      setLoading(false)
      return
    }

    const loadInvite = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use absolute URL to ensure proper routing
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const apiUrl = `${baseUrl}/api/invites/${encodeURIComponent(inviteCode)}`
        console.log('Fetching invite:', apiUrl)

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            error: response.status === 404 
              ? 'Invite not found' 
              : response.status === 410
              ? 'This invite has already been used'
              : 'Failed to load invite'
          }))
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to load invite`)
        }

        const data = await response.json()
        if (!data.invite) {
          throw new Error('Invalid response from server')
        }
        
        setInvite(data.invite)
      } catch (err: any) {
        console.error('Error loading invite:', err)
        setError(err.message || 'Failed to load invite. Please check the link and try again.')
      } finally {
        setLoading(false)
      }
    }

    // Small delay to ensure params are settled
    const timer = setTimeout(() => {
      loadInvite()
    }, 100)

    return () => clearTimeout(timer)
  }, [inviteCode])

  const handleAccept = async () => {
    if (!invite || !user) {
      // Redirect to login with redirect parameter
      router.push(`/auth/login?redirect_to=${encodeURIComponent(`/invite/${inviteCode}`)}`)
      return
    }

    setAccepting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?redirect=/invite/${inviteCode}`)
        return
      }

      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          invite_code: inviteCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invite')
      }

      toast({
        title: 'Welcome to Gathered!',
        description: invite.invite_type === 'group' 
          ? `You've joined ${invite.group?.name}!` 
          : 'You\'re now part of the Gathered community!',
        variant: 'success',
      })

      // Redirect to appropriate page
      router.push(data.redirect_path || '/dashboard')
    } catch (err: any) {
      console.error('Error accepting invite:', err)
      toast({
        title: 'Failed to accept invite',
        description: err.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading invite...</p>
        </div>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-slate-300 mb-6">
            {error || 'This invite link is invalid or has already been used.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-400 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-gold-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            You've been invited to Gathered
          </h1>

          {/* Group info (if applicable) */}
          {invite.invite_type === 'group' && invite.group && (
            <div className="mt-6 mb-6">
              <div className="bg-navy-800/50 border border-gold-500/30 rounded-xl p-4">
                {invite.group.avatar_url ? (
                  <img
                    src={invite.group.avatar_url}
                    alt={invite.group.name}
                    className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-gold-500/30"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-gold-500/30">
                    <Users className="w-8 h-8 text-gold-500" />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-white mb-1">
                  {invite.group.name}
                </h2>
                {invite.group.description && (
                  <p className="text-sm text-slate-300">
                    {invite.group.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <p className="text-slate-300 mb-8">
            {invite.invite_type === 'group'
              ? `Join this fellowship group and start connecting with others in your community.`
              : `Join Gathered and start connecting with your faith community.`}
          </p>

          {/* CTA */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-4 text-base font-semibold hover:bg-gold-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <>
                <span>Join & Continue</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {!user && (
            <p className="text-xs text-slate-400 mt-4">
              You'll be asked to sign in or create an account
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


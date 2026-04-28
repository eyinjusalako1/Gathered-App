'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

export default function ResetPasswordPage() {
  const router = useRouter()
  const toast = useToast()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        let { data } = await supabase.auth.getSession()
        let session = data.session

        if (!session && typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          const code = url.searchParams.get('code')
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (!error) {
              const next = await supabase.auth.getSession()
              session = next.data.session
            }
          }

          if (!session && window.location.hash) {
            const hash = new URLSearchParams(window.location.hash.substring(1))
            const access_token = hash.get('access_token')
            const refresh_token = hash.get('refresh_token')
            if (access_token && refresh_token) {
              const { data: setData, error: setError } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              })
              if (!setError) {
                session = setData.session
              }
            }
          }
        }

        setHasSession(!!session)
      } catch (error) {
        console.error('Reset session error:', error)
        setHasSession(false)
      } finally {
        setChecking(false)
      }
    }

    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters.',
        variant: 'error',
      })
      return
    }
    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please re-enter your password.',
        variant: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw error
      }

      // Sign out after a successful reset so the user must log in with their
      // new password — the recovery session should not become a regular session.
      await supabase.auth.signOut()

      toast({
        title: 'Password updated — you can sign in now.',
        variant: 'success',
      })

      router.replace('/auth/login?reset=success')
    } catch (err) {
      console.error('Password update error:', err)
      // Discard the recovery session on failure so it cannot be reused or
      // leave the user in a half-authenticated state.
      await supabase.auth.signOut()
      toast({
        title: 'Could not update password.',
        description: 'Please try again or request a new reset link.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center px-4 py-12">
        <div className="text-sm text-slate-400">Checking reset link...</div>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-navy-900/40 border border-white/10 rounded-2xl p-6 shadow-lg text-center">
          <h1 className="text-xl font-semibold mb-2">Reset link expired</h1>
          <p className="text-sm text-slate-400 mb-6">
            This reset link is invalid or expired. Request a new one.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center justify-center rounded-xl bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-navy-900/40 border border-white/10 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Create a new password</h1>
            <p className="text-sm text-slate-400">Use at least 8 characters.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-slate-300 mb-2">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-navy-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/60"
              placeholder="Enter a new password"
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-slate-300 mb-2">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl bg-navy-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/60"
              placeholder="Re-enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-gold-500 text-navy-900 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <div className="mt-6">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-gold-500 hover:text-gold-400"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}





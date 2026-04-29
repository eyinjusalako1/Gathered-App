'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

export default function ForgotPasswordPage() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      toast({
        title: 'Enter a valid email',
        description: 'Please double-check the email address.',
        variant: 'error',
      })
      return
    }

    setLoading(true)
    try {
      // Build an absolute URL using the canonical app origin.
      // Never fall back to window.location.origin — on Vercel that resolves to the
      // .vercel.app deployment URL, which isn't in the Supabase allowlist, causing
      // Supabase to silently discard redirectTo and fall back to the site root.
      const origin = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://gathered-app.com'
      ).replace(/\/$/, '')
      const redirectTo = `${origin}/auth/reset-password`
      console.log('[forgot-password] sending resetPasswordForEmail with redirectTo:', redirectTo)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (error) {
        throw error
      }

      toast({
        title: 'Check your email for the reset link.',
        variant: 'success',
      })
    } catch (err) {
      console.error('Reset email error:', err)
      toast({
        title: 'We could not send the reset email.',
        description: 'Please try again in a moment.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-navy-900/40 border border-white/10 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
            <Mail className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="text-sm text-slate-400">
              We&apos;ll email you a secure link to set a new password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-slate-300 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-navy-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/60"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold-500 text-navy-900 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send reset link'}
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





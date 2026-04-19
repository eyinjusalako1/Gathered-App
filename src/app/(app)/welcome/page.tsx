'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BookOpen, Compass, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useUserProfile } from '@/hooks/useUserProfile'

const getFirstName = (fullName: string | null | undefined): string => {
  if (!fullName?.trim()) return ''
  return fullName.trim().split(/\s+/)[0]
}

const ACTION_CARDS = [
  {
    href: '/devotions',
    icon: BookOpen,
    label: "Today's Devotion",
    description: "Start with today's word. It's already waiting for you.",
  },
  {
    href: '/fellowship',
    icon: Users,
    label: 'Find a Group',
    description: 'Join a fellowship group and grow with others who share your faith.',
  },
  {
    href: '/feed',
    icon: Compass,
    label: 'Explore Community',
    description: 'See what your community is sharing, praying for, and celebrating.',
  },
]

export default function WelcomePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading } = useUserProfile()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login')
    }
  }, [authLoading, user, router])

  if (authLoading || profileLoading || (!user && !authLoading)) {
    return (
      <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto" />
          <p className="mt-4 text-slate-400">Getting things ready...</p>
        </div>
      </main>
    )
  }

  const firstName = getFirstName(profile?.name)

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50 flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col justify-center gap-10">

        {/* Welcome header */}
        <section className="space-y-3">
          <p className="text-sm font-semibold text-gold-400 tracking-wide uppercase">
            You&apos;re in
          </p>
          <h1 className="text-4xl font-bold text-white leading-tight">
            {firstName ? `Welcome, ${firstName}.` : 'Welcome to Gathered.'}
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Your community is here. Here&apos;s where to begin.
          </p>
        </section>

        {/* Action cards */}
        <section className="space-y-3">
          {ACTION_CARDS.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-navy-800/40 p-5 transition-all hover:border-gold-500/40 hover:bg-navy-800/60"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 transition-colors group-hover:bg-gold-500/25">
                <Icon className="h-6 w-6 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-sm text-slate-400">{description}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-400" />
            </Link>
          ))}
        </section>

        {/* Enter Gathered CTA */}
        <section className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-navy-800/40 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">Ready to jump in?</p>
            <p className="mt-0.5 text-sm text-slate-400">
              You can come back to any of these whenever you like.
            </p>
          </div>
          <button
            onClick={() => router.replace('/dashboard')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-gold-600 shrink-0"
          >
            Enter Gathered
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

      </div>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  BookOpen,
  Flame,
  Users,
  Compass,
  MessageCircle,
  Calendar,
  Home,
  Heart,
  Search,
  MoreHorizontal,
} from 'lucide-react'

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Daily Devotions',
    description: 'A personalised word for you every day, shaped by your growth focus.',
  },
  {
    icon: Flame,
    title: 'Streak & Growth',
    description: 'Build consistency with daily streaks and track your spiritual journey.',
  },
  {
    icon: Users,
    title: 'Fellowship Groups',
    description: 'Join or lead groups that meet, pray, and grow together in real life.',
  },
  {
    icon: Compass,
    title: 'Discover Believers',
    description: 'Find people near you who share your faith, interests, and season of life.',
  },
  {
    icon: MessageCircle,
    title: 'Group Chat',
    description: 'Stay connected with your group between meetings — prayer requests and all.',
  },
  {
    icon: Calendar,
    title: 'Events',
    description: 'Create and RSVP to Bible studies, prayer nights, and community gatherings.',
  },
]

// ─── How it works steps ────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Create your account',
    description:
      'Sign up in seconds. Tell us a little about yourself and your faith journey so we can personalise your experience.',
  },
  {
    number: '02',
    title: 'Find your community',
    description:
      'Discover believers near you, join fellowship groups, and connect with people who get where you are.',
  },
  {
    number: '03',
    title: 'Grow together',
    description:
      'Show up daily — do your devotion, share a reflection, check in with your group. Faith grows in community.',
  },
]

// ─── Phone mockup ─────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[300px]">
      {/* Outer shell */}
      <div className="rounded-[2.5rem] border-2 border-white/10 bg-navy-900 shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <span className="text-[10px] text-slate-400">9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-1.5 rounded-sm bg-slate-400" />
            <div className="w-1 h-1.5 rounded-sm bg-slate-400" />
          </div>
        </div>

        {/* Screen content */}
        <div className="px-4 pb-4 space-y-3">
          {/* Greeting */}
          <div className="flex items-center gap-2 pt-1">
            <div className="w-7 h-7 rounded-full bg-gold-500/20 border border-gold-500/40 flex items-center justify-center">
              <span className="text-[9px] font-bold text-gold-400">JD</span>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-wide">Today on Gathered</p>
              <p className="text-[10px] font-semibold text-white">Hey, Jordan 👋</p>
            </div>
          </div>

          {/* Today's Word card */}
          <div className="rounded-xl border border-gold-600/30 bg-gradient-to-br from-navy-800/80 to-navy-900/80 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-gold-500/15 flex items-center justify-center">
                <BookOpen className="w-2.5 h-2.5 text-gold-400" />
              </div>
              <p className="text-[8px] font-semibold text-gold-400 uppercase tracking-wide">Today's Word</p>
            </div>
            <p className="text-[9px] font-bold text-white mb-1">Be Still and Know</p>
            <p className="text-[8px] text-slate-400 leading-relaxed line-clamp-2">
              "Be still, and know that I am God." — Psalm 46:10
            </p>
            <div className="mt-2">
              <div className="inline-flex items-center rounded-full bg-gold-500 px-2 py-0.5">
                <span className="text-[7px] font-bold text-navy-900">Open devotion →</span>
              </div>
            </div>
          </div>

          {/* People row */}
          <div>
            <p className="text-[8px] font-semibold text-slate-300 mb-1.5">People near you</p>
            <div className="flex gap-2">
              {['SC', 'AM', 'RL'].map((initials) => (
                <div key={initials} className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full bg-navy-800 border border-white/10 flex items-center justify-center">
                    <span className="text-[8px] font-semibold text-gold-400">{initials}</span>
                  </div>
                  <div className="w-10 h-1 rounded-full bg-navy-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-white/5 bg-navy-900/95 px-2 py-2 flex justify-around">
          {[Home, BookOpen, MessageCircle, Users, Compass].map((Icon, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${
                i === 0 ? 'text-gold-400' : 'text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <div className={`w-3 h-0.5 rounded-full ${i === 0 ? 'bg-gold-400' : 'bg-transparent'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Glow */}
      <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gold-500/10 blur-2xl scale-110" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [formError, setFormError] = useState('')

  // Redirect logged-in users to dashboard, unless they arrived with #feedback
  useEffect(() => {
    if (!authLoading && user) {
      if (typeof window !== 'undefined' && window.location.hash === '#feedback') {
        document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState('loading')
    setFormError('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong. Please try again.')
        setFormState('error')
      } else {
        setFormState('success')
        setFormData({ name: '', email: '', message: '' })
      }
    } catch {
      setFormError('Something went wrong. Please try again.')
      setFormState('error')
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-50">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-navy-900/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <span className="font-serif text-xl font-bold text-gold-400 tracking-tight">
            Gathered
          </span>
          <Link
            href="/auth/signup"
            className="rounded-full bg-gold-500 px-4 py-1.5 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
          >
            Join Gathered
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-14 px-4 text-center overflow-hidden">
        {/* Background radial glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold-500/5 blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Beta badge */}
          <div className="inline-flex items-center rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300 tracking-wide uppercase">
            Now in Beta
          </div>

          {/* Headline */}
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight tracking-tight">
            Community Built<br className="hidden sm:block" /> on Faith.
          </h1>

          {/* Subtext */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
            Gathered brings believers together — daily devotions, real connections, and fellowship groups that go beyond Sunday morning.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-full bg-gold-500 px-7 py-3.5 text-base font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
            >
              Join Gathered →
            </Link>
            <a
              href="#how"
              className="w-full sm:w-auto rounded-full border border-white/15 px-7 py-3.5 text-base font-semibold text-slate-300 hover:border-white/30 hover:text-white transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="mt-16 sm:mt-20">
          <PhoneMockup />
        </div>

        {/* Scroll hint */}
        <div className="mt-12 flex flex-col items-center gap-1 text-slate-600">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-slate-600" />
          <span className="text-xs tracking-widest uppercase">Scroll</span>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to grow in faith
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Gathered isn't just a Bible app or a church directory. It's where your faith community actually lives.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/8 bg-navy-800/40 p-5 space-y-3 hover:border-gold-500/20 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scripture quote ──────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-black/30 border-y border-white/5">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <blockquote className="font-serif text-xl sm:text-2xl md:text-3xl text-slate-200 italic leading-relaxed">
            "And let us consider how to stir up one another to love and good works, not neglecting to meet together, as is the habit of some, but encouraging one another."
          </blockquote>
          <cite className="block text-sm text-gold-400 font-semibold not-italic tracking-wide">
            Hebrews 10:24–25
          </cite>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-4 scroll-mt-14">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4">
              How it works
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              From sign-up to community in a few simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ number, title, description }) => (
              <div key={number} className="space-y-4">
                <span className="font-serif text-5xl font-bold text-gold-500/30">{number}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Ready to find your people?
          </h2>
          <p className="text-slate-400 text-lg">
            Join thousands of believers already growing together on Gathered.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center rounded-full bg-gold-500 px-8 py-4 text-base font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
          >
            Join Gathered →
          </Link>
        </div>
      </section>

      {/* ── Feedback form ────────────────────────────────────────────────── */}
      <section id="feedback" className="py-24 px-4 border-t border-white/5">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
              Share your thoughts
            </h2>
            <p className="text-slate-400 text-sm">
              We read every message. Tell us what you think, what you need, or just say hello.
            </p>
          </div>

          {formState === 'success' ? (
            <div className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-8 text-center space-y-2">
              <p className="text-lg font-semibold text-gold-300">Thanks! We'll be in touch.</p>
              <p className="text-sm text-slate-400">Your message has been sent to the Gathered team.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="What's on your mind?"
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-navy-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                />
              </div>

              {formState === 'error' && formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <button
                type="submit"
                disabled={formState === 'loading'}
                className="w-full rounded-xl bg-gold-500 py-3.5 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {formState === 'loading' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-3 text-center">
          <span className="font-serif text-lg font-bold text-gold-400">Gathered</span>
          <p className="text-xs text-slate-500">gathered-app.com</p>
          <p className="text-xs text-slate-600">© 2026 Gathered. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

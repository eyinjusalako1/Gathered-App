'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { Loader2, Plus, X, User, CheckCircle2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prayer {
  id: string
  content: string
  category: string | null
  is_anonymous: boolean
  status: string
  prayed_count: number
  created_at: string
  answered_at: string | null
  author_name: string | null
  author_avatar: string | null
  has_prayed: boolean
  is_own: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  for_someone_else: 'For someone else',
  for_myself:       'For myself',
  praise_report:    'Praise report',
}

const CATEGORY_COLORS: Record<string, string> = {
  for_someone_else: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  for_myself:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  praise_report:    'bg-gold-500/20 text-gold-400 border-gold-500/30',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrayerWallPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [prayers, setPrayers] = useState<Prayer[]>([])
  const [activeTab, setActiveTab] = useState<'praying' | 'answered'>('praying')
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)

  // Post sheet state
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // WHY ref not state: prevents double-tap race without triggering a re-render
  const prayingInFlight = useRef<Set<string>>(new Set())

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    }
  }, [])

  const loadPrayers = useCallback(async () => {
    if (!user?.id) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/wall?status=${activeTab}`, { headers })
      if (res.ok) {
        const { prayers: data } = await res.json()
        setPrayers(data ?? [])
      }
    } catch (err) {
      console.error('Error loading prayers:', err)
    }
  }, [user?.id, activeTab, getAuthHeaders])

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    loadPrayers().finally(() => setLoading(false))
  }, [user?.id, loadPrayers])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePray = async (prayerId: string) => {
    if (prayingInFlight.current.has(prayerId)) return

    const original = prayers.find(p => p.id === prayerId)
    if (!original) return

    prayingInFlight.current.add(prayerId)

    // Optimistic flip — will be reconciled with authoritative server values on response
    setPrayers(prev => prev.map(p =>
      p.id !== prayerId ? p : {
        ...p,
        has_prayed:   !p.has_prayed,
        prayed_count: p.has_prayed ? p.prayed_count - 1 : p.prayed_count + 1,
      }
    ))

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/${prayerId}/pray`, { method: 'POST', headers })
      if (res.ok) {
        const { prayed_count, has_prayed } = await res.json()
        setPrayers(prev => prev.map(p =>
          p.id !== prayerId ? p : { ...p, prayed_count, has_prayed }
        ))
      } else {
        // Revert to captured pre-tap state
        setPrayers(prev => prev.map(p =>
          p.id !== prayerId ? p : { ...p, has_prayed: original.has_prayed, prayed_count: original.prayed_count }
        ))
      }
    } catch {
      setPrayers(prev => prev.map(p =>
        p.id !== prayerId ? p : { ...p, has_prayed: original.has_prayed, prayed_count: original.prayed_count }
      ))
    } finally {
      prayingInFlight.current.delete(prayerId)
    }
  }

  const handleMarkAnswered = async (prayerId: string) => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/${prayerId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'answered' }),
      })
      if (res.ok) {
        // Remove immediately — prayer now lives on the Answered tab
        setPrayers(prev => prev.filter(p => p.id !== prayerId))
      } else {
        toast({ title: 'Could not mark as answered', description: 'Please try again.', variant: 'error' })
      }
    } catch (err) {
      console.error('Error marking answered:', err)
      toast({ title: 'Could not mark as answered', description: 'Please try again.', variant: 'error' })
    }
  }

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/prayers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content:      content.trim(),
          category:     category ?? null,
          is_anonymous: isAnonymous,
        }),
      })
      if (res.ok) {
        setContent('')
        setCategory(null)
        setIsAnonymous(false)
        setShowSheet(false)
        if (activeTab === 'praying') {
          await loadPrayers()
        } else {
          // Switching tab triggers loadPrayers via the useEffect dependency
          setActiveTab('praying')
        }
      } else {
        toast({ title: 'Could not share prayer', description: 'Please try again.', variant: 'error' })
      }
    } catch (err) {
      console.error('Error posting prayer:', err)
      toast({ title: 'Could not share prayer', description: 'Please try again.', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading prayers...</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-50 mb-1">Prayer Wall</h1>
          <p className="text-slate-400 text-sm">Lift each other up in prayer</p>

          {/* Tabs */}
          <div className="flex space-x-2 mt-4 bg-navy-800/30 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('praying')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'praying'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Praying
            </button>
            <button
              onClick={() => setActiveTab('answered')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'answered'
                  ? 'bg-gold-500 text-navy-900'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Answered 🙌
            </button>
          </div>
        </div>

        {/* Prayer list */}
        {prayers.length === 0 ? (
          <EmptyState tab={activeTab} onPost={() => setShowSheet(true)} />
        ) : (
          <div className="space-y-3">
            {prayers.map(prayer => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                onPray={handlePray}
                onMarkAnswered={handleMarkAnswered}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating action button */}
      <button
        onClick={() => setShowSheet(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gold-500 hover:bg-gold-600 active:scale-95 text-navy-900 rounded-full shadow-lg shadow-gold-500/20 flex items-center justify-center transition-all z-40"
        aria-label="Share a prayer"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Post sheet */}
      {showSheet && (
        <PostSheet
          content={content}
          category={category}
          isAnonymous={isAnonymous}
          submitting={submitting}
          onContentChange={setContent}
          onCategoryChange={setCategory}
          onAnonymousChange={setIsAnonymous}
          onSubmit={handleSubmit}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  )
}

// ── Prayer card ───────────────────────────────────────────────────────────────

function PrayerCard({
  prayer,
  onPray,
  onMarkAnswered,
}: {
  prayer: Prayer
  onPray: (id: string) => void
  onMarkAnswered: (id: string) => void
}) {
  return (
    <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4 transition-colors hover:border-white/15">

      {/* Author row */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center space-x-2 min-w-0">
          {/* WHY: author_avatar (and author_name) are already NULL when is_anonymous=true —
              the RPC strips them via CASE WHEN is_anonymous THEN NULL (add-prayer-wall.sql,
              get_global_prayer_wall). This component is intentionally naive: it just falls
              back to the generic User icon on null. If that CASE is ever removed from the
              RPC, anonymity breaks at the DB layer and is auditable there — not silently here. */}
          {prayer.author_avatar ? (
            <img
              src={prayer.author_avatar}
              alt={prayer.author_name ?? 'User'}
              className="w-8 h-8 rounded-full border border-gold-500/30 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-navy-800/60 border border-white/10 flex items-center justify-center flex-shrink-0">
              {prayer.is_anonymous || !prayer.author_name ? (
                <User className="w-4 h-4 text-slate-500" />
              ) : (
                <span className="text-xs font-bold text-gold-500">
                  {prayer.author_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {/* author_name is null when anonymous — RPC enforces this */}
              {prayer.author_name ?? 'Anonymous'}
            </p>
            <p className="text-xs text-slate-500">{formatTime(prayer.created_at)}</p>
          </div>
        </div>

        {/* Category badge */}
        {prayer.category && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
            CATEGORY_COLORS[prayer.category] ?? 'bg-slate-700/50 text-slate-300 border-slate-600/30'
          }`}>
            {CATEGORY_LABELS[prayer.category] ?? prayer.category}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-slate-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap break-words">
        {prayer.content}
      </p>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2">

        {/* I Prayed — optimistic fill, gold when active */}
        <button
          onClick={() => onPray(prayer.id)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
            prayer.has_prayed
              ? 'bg-gold-500/20 text-gold-400 border-gold-500/30'
              : 'bg-navy-800/60 text-slate-400 border-white/10 hover:border-gold-500/20 hover:text-slate-300'
          }`}
        >
          <span>🙏</span>
          {prayer.prayed_count > 0 && (
            <span className="tabular-nums">{prayer.prayed_count}</span>
          )}
          <span>{prayer.has_prayed ? 'Prayed' : 'I prayed'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Mark answered — author only, praying tab only */}
          {prayer.is_own && prayer.status === 'praying' && (
            <button
              onClick={() => onMarkAnswered(prayer.id)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800/60 text-slate-400 border border-white/10 hover:border-green-500/30 hover:text-green-400 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Answered</span>
            </button>
          )}

          {/* Answered timestamp — visible on Answered tab */}
          {prayer.status === 'answered' && prayer.answered_at && (
            <div className="flex items-center space-x-1 text-xs text-green-400/80">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Answered {formatTime(prayer.answered_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({ tab, onPost }: { tab: 'praying' | 'answered'; onPost: () => void }) {
  if (tab === 'answered') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-navy-800/40 border border-gold-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-gold-500/50" />
        </div>
        <h3 className="text-lg font-semibold text-slate-50 mb-2">No answered prayers yet</h3>
        <p className="text-slate-400 text-sm text-center max-w-sm">
          When someone marks their prayer as answered, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-5xl mb-4">🙏</div>
      <h3 className="text-lg font-semibold text-slate-50 mb-2">Be the first to share</h3>
      <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
        Share what&apos;s on your heart — the community is here to pray with you.
      </p>
      <button
        onClick={onPost}
        className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg font-medium transition-colors"
      >
        Share a prayer
      </button>
    </div>
  )
}

// ── Post sheet ────────────────────────────────────────────────────────────────

function PostSheet({
  content,
  category,
  isAnonymous,
  submitting,
  onContentChange,
  onCategoryChange,
  onAnonymousChange,
  onSubmit,
  onClose,
}: {
  content: string
  category: string | null
  isAnonymous: boolean
  submitting: boolean
  onContentChange: (v: string) => void
  onCategoryChange: (v: string | null) => void
  onAnonymousChange: (v: boolean) => void
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — max-h + overflow-y-auto so submit button is always reachable on small phones */}
      <div
        className="relative w-full max-w-2xl bg-navy-900 border border-white/10 rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90svh' }}
      >
        <div className="overflow-y-auto flex flex-col p-6" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

        {/* Sheet header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-50">Share a prayer</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-navy-800/60 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea */}
        <div className="relative mb-4">
          <textarea
            value={content}
            onChange={e => onContentChange(e.target.value.slice(0, 1000))}
            placeholder="Share what's on your heart..."
            className="w-full bg-navy-800/50 border border-white/10 rounded-xl p-3 text-slate-200 placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-gold-500/40 transition-colors"
            rows={5}
            autoFocus
          />
          <span className={`absolute bottom-3 right-3 text-xs pointer-events-none ${
            content.length > 950 ? 'text-amber-400' : 'text-slate-600'
          }`}>
            {content.length}/1000
          </span>
        </div>

        {/* Category selector */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            Category <span className="normal-case font-normal">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => onCategoryChange(category === key ? null : key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  category === key
                    ? 'bg-gold-500/20 text-gold-400 border-gold-500/30'
                    : 'bg-navy-800/60 text-slate-400 border-white/10 hover:border-white/20 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Anonymity toggle */}
        <div className="flex items-center justify-between mb-6 p-3 bg-navy-800/40 rounded-xl border border-white/5">
          <div>
            <p className="text-sm font-medium text-slate-200">Post anonymously</p>
            <p className="text-xs text-slate-500 mt-0.5">Your name will be hidden from others</p>
          </div>
          <button
            onClick={() => onAnonymousChange(!isAnonymous)}
            role="switch"
            aria-checked={isAnonymous}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors focus:outline-none ${
              isAnonymous ? 'bg-gold-500 border-gold-500' : 'bg-navy-700 border-navy-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
              isAnonymous ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={!content.trim() || submitting}
          className="w-full py-3 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-navy-900 font-semibold rounded-xl transition-colors"
        >
          {submitting ? 'Posting...' : 'Share prayer'}
        </button>
        </div>{/* end scrollable body */}
      </div>
    </div>
  )
}

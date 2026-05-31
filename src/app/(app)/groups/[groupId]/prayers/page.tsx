'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { Loader2, Plus, X, ArrowLeft } from 'lucide-react'
import PrayerCard, { Prayer, CATEGORY_LABELS, CATEGORY_COLORS } from '@/components/PrayerCard'

export const dynamic = 'force-dynamic'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupPrayerWallPage({
  params,
}: {
  params: { groupId: string }
}) {
  const { groupId } = params
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [groupName, setGroupName] = useState<string>('')
  const [prayers, setPrayers] = useState<Prayer[]>([])
  const [activeTab, setActiveTab] = useState<'praying' | 'answered'>('praying')
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)

  // Post sheet state
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const authorName = user?.email?.split('@')[0] ?? 'You'

  // WHY ref not state: prevents double-tap race without triggering a re-render
  const prayingInFlight = useRef<Set<string>>(new Set())

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    }
  }, [])

  // Fetch group name once on mount
  useEffect(() => {
    if (!groupId) return
    supabase
      .from('fellowship_groups')
      .select('name')
      .eq('id', groupId)
      .single()
      .then(({ data }) => {
        if (data?.name) setGroupName(data.name)
      })
  }, [groupId])

  const loadPrayers = useCallback(async () => {
    if (!user?.id) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/groups/${groupId}/prayers?status=${activeTab}`, { headers })
      if (res.ok) {
        const { prayers: data } = await res.json()
        setPrayers(data ?? [])
      }
    } catch (err) {
      console.error('Error loading group prayers:', err)
    }
  }, [user?.id, groupId, activeTab, getAuthHeaders])

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

    // Optimistic flip — reconciled with authoritative server values on response
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
        setPrayers(prev => prev.map(p =>
          p.id !== prayerId ? p : {
            ...p,
            has_prayed:   original.has_prayed,
            prayed_count: original.prayed_count,
          }
        ))
      }
    } catch {
      setPrayers(prev => prev.map(p =>
        p.id !== prayerId ? p : {
          ...p,
          has_prayed:   original.has_prayed,
          prayed_count: original.prayed_count,
        }
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
        setPrayers(prev => prev.filter(p => p.id !== prayerId))
      } else {
        toast({ title: 'Could not mark as answered', description: 'Please try again.', variant: 'error' })
      }
    } catch {
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
          group_id:     groupId,
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
          setActiveTab('praying')
        }
      } else {
        const body = await res.json().catch(() => ({}))
        toast({
          title: 'Could not share prayer',
          description: body.error ?? 'Please try again.',
          variant: 'error',
        })
      }
    } catch {
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
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-50 mb-1">
            {groupName ? `${groupName} Prayer Wall` : 'Prayer Wall'}
          </h1>
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
          <GroupEmptyState tab={activeTab} onPost={() => setShowSheet(true)} />
        ) : (
          <div className="space-y-3">
            {prayers.map(prayer => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                groupId={groupId}
                authorName={authorName}
                onPray={handlePray}
                onMarkAnswered={handleMarkAnswered}
                getAuthHeaders={getAuthHeaders}
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
        <GroupPostSheet
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

// ── Empty states ──────────────────────────────────────────────────────────────

function GroupEmptyState({
  tab,
  onPost,
}: {
  tab: 'praying' | 'answered'
  onPost: () => void
}) {
  if (tab === 'answered') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-navy-800/40 border border-gold-500/20 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🙌</span>
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
      <h3 className="text-lg font-semibold text-slate-50 mb-2">Share the first prayer</h3>
      <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
        Your group is here to pray with you. Share what&apos;s on your heart.
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

function GroupPostSheet({
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

      <div
        className="relative w-full max-w-2xl bg-navy-900 border border-white/10 rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90svh' }}
      >
        <div className="overflow-y-auto flex flex-col p-6" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

          {/* Sheet header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-50">Share with your group</h2>
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
              <p className="text-xs text-slate-500 mt-0.5">Your name will be hidden from group members</p>
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
        </div>
      </div>
    </div>
  )
}

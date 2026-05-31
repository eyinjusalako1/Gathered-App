'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, CheckCircle2, Trash2, ChevronDown } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Prayer {
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
  comment_count: number
}

export interface PrayerComment {
  id: string
  content: string
  created_at: string
  author_name: string
  author_avatar: string | null
  is_own: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  for_someone_else: 'For someone else',
  for_myself:       'For myself',
  praise_report:    'Praise report',
}

export const CATEGORY_COLORS: Record<string, string> = {
  for_someone_else: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  for_myself:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  praise_report:    'bg-gold-500/20 text-gold-400 border-gold-500/30',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7)   return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── PrayerCard ────────────────────────────────────────────────────────────────

export default function PrayerCard({
  prayer,
  groupId = null,
  authorName = 'You',
  onPray,
  onMarkAnswered,
  getAuthHeaders,
}: {
  prayer: Prayer
  groupId?: string | null
  authorName?: string
  onPray: (id: string) => void
  onMarkAnswered: (id: string) => void
  getAuthHeaders: () => Promise<HeadersInit>
}) {
  const [localComments, setLocalComments] = useState<PrayerComment[]>([])
  const [localCommentCount, setLocalCommentCount] = useState(prayer.comment_count)
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/${prayer.id}/comments`, { headers })
      if (res.ok) {
        const { comments } = await res.json()
        setLocalComments(comments ?? [])
      }
    } catch {
      // silently — comments failing to load should not break the prayer card
    } finally {
      setCommentsLoaded(true)
    }
  }, [prayer.id, getAuthHeaders])

  useEffect(() => {
    if (!groupId) return
    loadComments()
  }, [groupId, loadComments])

  const handlePostComment = async () => {
    const trimmed = commentInput.trim()
    if (!trimmed || submittingComment) return

    setSubmittingComment(true)
    setCommentError(null)

    const tempId = `temp-${Date.now()}`
    const optimistic: PrayerComment = {
      id:           tempId,
      content:      trimmed,
      created_at:   new Date().toISOString(),
      author_name:  authorName,
      author_avatar: null,
      is_own:       true,
    }

    // Optimistic update: append immediately and increment count before response
    setLocalComments(prev => [...prev, optimistic])
    setLocalCommentCount(prev => prev + 1)
    setCommentInput('')

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/${prayer.id}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: trimmed }),
      })

      if (res.ok) {
        const { comment: saved } = await res.json()
        // Reconcile: swap temp id and created_at with authoritative server values
        setLocalComments(prev =>
          prev.map(c =>
            c.id === tempId
              ? { ...optimistic, id: saved.id, created_at: saved.created_at }
              : c
          )
        )
      } else {
        const errBody = await res.json().catch(() => ({}))
        setLocalComments(prev => prev.filter(c => c.id !== tempId))
        setLocalCommentCount(prev => prev - 1)
        setCommentError(errBody.error ?? 'Could not post comment')
      }
    } catch {
      setLocalComments(prev => prev.filter(c => c.id !== tempId))
      setLocalCommentCount(prev => prev - 1)
      setCommentError('Could not post comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const removed = localComments.find(c => c.id === commentId)
    setLocalComments(prev => prev.filter(c => c.id !== commentId))
    setLocalCommentCount(prev => Math.max(prev - 1, 0))

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/prayers/${prayer.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok && removed) {
        setLocalComments(prev =>
          [...prev, removed].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        )
        setLocalCommentCount(prev => prev + 1)
      }
    } catch {
      if (removed) {
        setLocalComments(prev =>
          [...prev, removed].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        )
        setLocalCommentCount(prev => prev + 1)
      }
    }
  }

  // localComments is sorted ASC by the RPC (oldest first).
  // "last 2" = the 2 most recent = the last 2 elements of the array.
  const displayedComments = !showAllComments && localComments.length > 2
    ? localComments.slice(-2)
    : localComments

  return (
    <div className="bg-navy-900/40 border border-white/10 rounded-xl p-4 transition-colors hover:border-white/15">

      {/* Author row */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center space-x-2 min-w-0">
          {/* WHY: author_avatar/name are NULL when is_anonymous=true — the RPC strips them
              via CASE WHEN is_anonymous THEN NULL. This component is intentionally naive:
              it just falls back to the User icon when both are null. */}
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
              {prayer.author_name ?? 'Anonymous'}
            </p>
            <p className="text-xs text-slate-500">{formatTime(prayer.created_at)}</p>
          </div>
        </div>

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
          {prayer.is_own && prayer.status === 'praying' && (
            <button
              onClick={() => onMarkAnswered(prayer.id)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800/60 text-slate-400 border border-white/10 hover:border-green-500/30 hover:text-green-400 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Answered</span>
            </button>
          )}

          {prayer.status === 'answered' && prayer.answered_at && (
            <div className="flex items-center space-x-1 text-xs text-green-400/80">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Answered {formatTime(prayer.answered_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Comments section — rendered only on group walls ─────────────────── */}
      {groupId && (
        <div className="mt-4 pt-4 border-t border-white/5">

          {/* "See all" expander */}
          {!showAllComments && localComments.length > 2 && (
            <button
              onClick={() => setShowAllComments(true)}
              className="flex items-center gap-1 text-xs text-gold-500/80 hover:text-gold-400 mb-3 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              See all {localCommentCount} comments
            </button>
          )}

          {/* Loading skeleton — shown while comments fetch if count > 0 */}
          {!commentsLoaded && localCommentCount > 0 && (
            <div className="space-y-2 mb-3">
              {Array.from({ length: Math.min(localCommentCount, 2) }).map((_, i) => (
                <div key={i} className="h-8 bg-navy-800/40 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {/* Comment list */}
          {commentsLoaded && displayedComments.length > 0 && (
            <div className="space-y-2 mb-3">
              {displayedComments.map(comment => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}

          {/* Inline error */}
          {commentError && (
            <p className="text-xs text-red-400 mb-2">{commentError}</p>
          )}

          {/* Composer */}
          <div className="flex gap-2 items-end">
            <textarea
              value={commentInput}
              onChange={e => {
                setCommentInput(e.target.value.slice(0, 500))
                setCommentError(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() }
              }}
              placeholder={localCommentCount === 0 ? 'Be the first to comment…' : 'Add a comment…'}
              rows={1}
              className="flex-1 bg-navy-800/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-gold-500/30 transition-colors leading-relaxed"
              style={{ minHeight: '32px', maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={handlePostComment}
              disabled={!commentInput.trim() || submittingComment}
              className="px-3 py-1.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              {submittingComment ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Comment row ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  onDelete,
}: {
  comment: PrayerComment
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-2 pl-1">
      {comment.author_avatar ? (
        <img
          src={comment.author_avatar}
          alt={comment.author_name}
          className="w-5 h-5 rounded-full border border-white/10 flex-shrink-0 mt-1"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-navy-800/80 border border-white/10 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-[8px] font-bold text-gold-500/80">
            {comment.author_name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0 bg-navy-800/40 rounded-lg px-2.5 py-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300 truncate">
            {comment.author_name}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-slate-600">{formatTime(comment.created_at)}</span>
            {comment.is_own && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-slate-600 hover:text-red-400 transition-colors"
                aria-label="Delete comment"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 break-words leading-relaxed">
          {comment.content}
        </p>
      </div>
    </div>
  )
}

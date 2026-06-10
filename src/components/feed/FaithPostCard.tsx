'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FaithPost {
  post_id: string
  author_id: string
  author_name: string
  author_avatar_url: string | null
  post_type: string
  content: string
  visibility: 'public' | 'connections'
  created_at: string
  reactions: Record<string, number>
  user_reaction: string | null
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  reflection: { label: 'Reflection', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  prayer:     { label: 'Prayer',     cls: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
  verse:      { label: 'Verse',      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  testimony:  { label: 'Testimony',  cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
}

const REACTIONS = [
  { type: 'amen',  emoji: '🙏', label: 'Amen' },
  { type: 'heart', emoji: '❤️', label: 'Heart' },
  { type: 'fire',  emoji: '🔥', label: 'Fire' },
]

function timeAgo(ds: string): string {
  const m = Math.floor((Date.now() - new Date(ds).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface Props {
  post: FaithPost
}

export default function FaithPostCard({ post }: Props) {
  const [reactions, setReactions] = useState(post.reactions ?? {})
  const [userReaction, setUserReaction] = useState(post.user_reaction)
  const [busy, setBusy] = useState(false)

  const meta = TYPE_META[post.post_type] ?? { label: post.post_type, cls: 'text-slate-400 bg-white/5 border-white/10' }

  const handleReact = async (type: string) => {
    if (busy) return
    setBusy(true)
    const removing = userReaction === type
    const snap = { reactions, userReaction }

    setReactions(r => {
      const next = { ...r }
      if (removing) {
        next[type] = Math.max(0, (next[type] ?? 0) - 1)
        if (!next[type]) delete next[type]
      } else {
        if (userReaction) {
          next[userReaction] = Math.max(0, (next[userReaction] ?? 0) - 1)
          if (!next[userReaction]) delete next[userReaction]
        }
        next[type] = (next[type] ?? 0) + 1
      }
      return next
    })
    setUserReaction(removing ? null : type)

    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      const res = await fetch('/api/feed/react', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ post_id: post.post_id, reaction_type: type }),
      })
      if (!res.ok) { setReactions(snap.reactions); setUserReaction(snap.userReaction) }
    } catch {
      setReactions(snap.reactions)
      setUserReaction(snap.userReaction)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-navy-800/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt={post.author_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-semibold text-gold-500">{initials(post.author_name)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{post.author_name}</p>
            <p className="text-[11px] text-slate-500">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-1.5 pt-0.5">
        {REACTIONS.map(({ type, emoji, label }) => {
          const count = reactions[type] ?? 0
          const active = userReaction === type
          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              aria-label={label}
              disabled={busy}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all disabled:opacity-60 ${
                active
                  ? 'border-gold-500/50 bg-gold-500/15 text-gold-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <span className="leading-none">{emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

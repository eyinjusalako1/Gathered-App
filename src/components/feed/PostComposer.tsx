'use client'

import { useState } from 'react'
import { X, Globe, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BottomSheet from '@/components/ui/BottomSheet'

const POST_TYPES = [
  { value: 'thought',         label: 'Reflection', emoji: '💭' },
  { value: 'prayer_request',  label: 'Prayer',     emoji: '🙏' },
  { value: 'verse',           label: 'Verse',      emoji: '📖' },
  { value: 'testimony',       label: 'Testimony',  emoji: '✨' },
]

const PLACEHOLDERS: Record<string, string> = {
  thought:        "What's on your heart today?",
  prayer_request: 'Share a prayer request or praise…',
  verse:          'Share a verse that spoke to you…',
  testimony:      'Share what God has done…',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onPosted: () => void
  userId: string
}

export default function PostComposer({ isOpen, onClose, onPosted, userId }: Props) {
  const [postType, setPostType] = useState('thought')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'connections'>('public')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (submitting) return
    setContent('')
    setPostType('reflection')
    setVisibility('public')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const { error: insertErr } = await supabase.from('faith_posts').insert({
        author_id: userId,
        post_type: postType,
        content: trimmed,
        visibility,
      })

      if (insertErr) throw insertErr

      // Mark has_posted in user_feed_state
      await supabase
        .from('user_feed_state')
        .upsert({ user_id: userId, has_posted: true }, { onConflict: 'user_id' })

      setContent('')
      setPostType('reflection')
      setVisibility('public')
      onPosted()
      onClose()
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = content.length
  const overLimit = charCount > 500

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title="Share with your community"
      maxHeight="85vh"
      disableDrag
      footer={
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <span className={`text-xs ${overLimit ? 'text-red-400' : 'text-slate-500'}`}>
            {charCount}/500
          </span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || overLimit || submitting}
            className="rounded-full bg-gold-500 text-navy-900 px-5 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Post type selector */}
        <div className="flex gap-2 flex-wrap">
          {POST_TYPES.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => setPostType(value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                postType === value
                  ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={PLACEHOLDERS[postType]}
          rows={5}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-navy-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20 transition-colors"
        />

        {/* Visibility toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVisibility('public')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              visibility === 'public'
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
            }`}
          >
            <Globe className="w-3 h-3" />
            Everyone
          </button>
          <button
            onClick={() => setVisibility('connections')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              visibility === 'connections'
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
            }`}
          >
            <Users className="w-3 h-3" />
            Connections only
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    </BottomSheet>
  )
}

'use client'

import FaithPostCard, { FaithPost } from './FaithPostCard'

const STARTER_POSTS: FaithPost[] = [
  {
    post_id: 'starter-1',
    author_id: 'starter',
    author_name: 'Sarah M.',
    author_avatar_url: null,
    post_type: 'verse',    content: '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future." — Jeremiah 29:11\n\nThis verse has been carrying me through a tough season. Grateful for it today.',
    visibility: 'public',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    reactions: { amen: 7, heart: 4 },
    edited_at: null,
    user_reaction: null,
  },
  {
    post_id: 'starter-2',
    author_id: 'starter',
    author_name: 'David O.',
    author_avatar_url: null,
    post_type: 'prayer_request',
    content: "Praying for everyone who's struggling this week. You're not alone — God sees you and so does this community. 🙏",
    visibility: 'public',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    reactions: { amen: 12, heart: 6, fire: 3 },
    edited_at: null,
    user_reaction: null,
  },
  {
    post_id: 'starter-3',
    author_id: 'starter',
    author_name: 'Grace A.',
    author_avatar_url: null,
    post_type: 'testimony',    content: "God came through in the most unexpected way today. I'd been praying about a situation for months — and this morning it just resolved. Never stop trusting Him. ✨",
    visibility: 'public',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    reactions: { amen: 9, fire: 5, heart: 8 },
    edited_at: null,
    user_reaction: null,
  },
]

interface Props {
  onCompose: () => void
}

export default function StarterFeed({ onCompose }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 text-center">
        Here&apos;s what your feed looks like — follow believers to see their posts here.
      </p>
      {STARTER_POSTS.map(post => (
        <FaithPostCard key={post.post_id} post={post} />
      ))}
      <button
        onClick={onCompose}
        className="w-full rounded-2xl border border-dashed border-gold-500/30 py-4 text-sm text-gold-400 hover:bg-gold-500/5 transition-colors"
      >
        + Share something yourself
      </button>
    </div>
  )
}

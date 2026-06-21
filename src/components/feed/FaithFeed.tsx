'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FaithPostCard, { FaithPost } from './FaithPostCard'
import FirstPostPrompt from './FirstPostPrompt'
import StarterFeed from './StarterFeed'
import FeedOnboardingOverlay from './FeedOnboardingOverlay'
import PostComposer from './PostComposer'
import { Loader2, MapPin } from 'lucide-react'

const PAGE_SIZE = 10
const SUGGESTION_INTERVAL = 8

const getInitials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

// ─── Follow suggestion card (injected in-feed every SUGGESTION_INTERVAL posts) ──

interface FollowSuggestion {
  id: string
  name: string | null
  city: string | null
  avatar_url?: string | null
}

function FollowSuggestionCard({ people }: { people: FollowSuggestion[] }) {
  const router = useRouter()

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-navy-800/50 p-4 space-y-3">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
        People to follow
      </p>
      <div className="space-y-3">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center shrink-0 overflow-hidden">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-gold-500">
                  {getInitials(person.name || '?')}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">
                {person.name || 'New friend'}
              </p>
              {person.city && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {person.city}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/discover')}
              className="rounded-full bg-gold-500 text-navy-900 px-3 py-1 text-[11px] font-semibold hover:bg-gold-600 transition-colors shrink-0"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main feed ──────────────────────────────────────────────────────────────

interface Props {
  userId: string
  followSuggestions?: FollowSuggestion[]
  userName?: string | null
  userAvatarUrl?: string | null
  isComposerOpen?: boolean
  onComposerClose?: () => void
}

export default function FaithFeed({ userId, followSuggestions, userName, userAvatarUrl, isComposerOpen: externalOpen, onComposerClose }: Props) {
  const [posts, setPosts] = useState<FaithPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hasPosts, setHasPosts] = useState<boolean | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<FaithPost | null>(null)
  const offsetRef = useRef(0)

  const composerVisible = !!externalOpen || composerOpen
  const closeComposer = () => {
    setComposerOpen(false)
    setEditingPost(null)
    onComposerClose?.()
  }

  const fetchFeed = useCallback(async (offset: number, append: boolean) => {
    try {
      const { data, error } = await supabase.rpc('get_faith_feed', {
        p_user_id: userId,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })

      if (error) throw error

      const rows = (data as FaithPost[]) ?? []
      setPosts(prev => append ? [...prev, ...rows] : rows)
      setHasMore(rows.length === PAGE_SIZE)
      offsetRef.current = offset + rows.length
    } catch {
      // fail silently — feed shows empty state
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [userId])

  const fetchHasPosted = useCallback(async () => {
    const { data } = await supabase
      .from('user_feed_state')
      .select('has_posted')
      .eq('user_id', userId)
      .single()
    setHasPosts(data?.has_posted ?? false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    offsetRef.current = 0
    fetchFeed(0, false)
    fetchHasPosted()
  }, [userId, fetchFeed, fetchHasPosted])

  // Realtime: INSERT/UPDATE/DELETE all refetch page 1 via RPC so edits and deletes
  // propagate live to other users. Own actions are handled optimistically above;
  // the refetch reconciles the real state without a loading spinner.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`faith-feed:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faith_posts' },
        async () => {
          try {
            const { data } = await supabase.rpc('get_faith_feed', {
              p_user_id: userId,
              p_limit: PAGE_SIZE,
              p_offset: 0,
            })
            const fresh = (data as FaithPost[]) ?? []
            if (fresh.length === 0) return
            setPosts(prev => {
              const freshIds = new Set(fresh.map(p => p.post_id))
              // Preserve paginated posts beyond page 1 that aren't in the fresh set
              const beyond = prev.filter(p => !freshIds.has(p.post_id) && !p.post_id.startsWith('opt-'))
              return [...fresh, ...beyond]
            })
          } catch { /* fail silently — feed stays as-is */ }
        }
      )
      .subscribe((status, err) => {
        console.log('[FaithFeed realtime]', status, err ?? '')
      })

    return () => { channel.unsubscribe() }
  }, [userId])

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchFeed(offsetRef.current, true)
  }

  const handleEdit = useCallback((post: FaithPost) => {
    setEditingPost(post)
  }, [])

  const handleUpdated = useCallback((updated: {
    post_id: string
    post_type: string
    content: string
    visibility: 'public' | 'connections'
    edited_at: string
  }) => {
    setPosts(prev => prev.map(p =>
      p.post_id === updated.post_id
        ? { ...p, post_type: updated.post_type, content: updated.content, visibility: updated.visibility, edited_at: updated.edited_at }
        : p
    ))
    setEditingPost(null)
  }, [])

  const handleDelete = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.post_id !== postId))
  }, [])

  const handlePosted = (data: { post_type: string; content: string; visibility: 'public' | 'connections' }) => {
    const optimistic: FaithPost = {
      post_id: `opt-${Date.now()}`,
      author_id: userId,
      author_name: userName || '',
      author_avatar_url: userAvatarUrl ?? null,
      post_type: data.post_type,
      content: data.content,
      visibility: data.visibility,
      created_at: new Date().toISOString(),
      edited_at: null,
      reactions: {},
      user_reaction: null,
    }
    setHasPosts(true)
    setPosts(prev => [optimistic, ...prev])
    offsetRef.current = 0
    fetchFeed(0, false)
  }

  const showStarterFeed = !loading && posts.length === 0

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Faith Feed</h2>
        {posts.length > 0 && (
          <button
            onClick={() => setComposerOpen(true)}
            className="rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-300 hover:bg-gold-500/20 transition-colors"
          >
            + Share
          </button>
        )}
      </div>

      <FeedOnboardingOverlay onDismiss={() => {}} />

      {!hasPosts && !loading && <FirstPostPrompt onCompose={() => setComposerOpen(true)} />}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 bg-navy-800/50 p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-white/10 rounded-full w-1/3" />
                  <div className="h-2.5 bg-white/10 rounded-full w-1/5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-white/10 rounded-full w-full" />
                <div className="h-3 bg-white/10 rounded-full w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : showStarterFeed ? (
        <StarterFeed onCompose={() => setComposerOpen(true)} />
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => {
            // Inject a follow suggestion card after every 8th post.
            // Each slot uses a non-overlapping pair from the suggestions array,
            // so no user appears twice in a session.
            const isSlotBoundary = (index + 1) % SUGGESTION_INTERVAL === 0
            const slotIndex = Math.floor(index / SUGGESTION_INTERVAL)
            const pairStart = slotIndex * 2
            const pair = followSuggestions?.slice(pairStart, pairStart + 2) ?? []
            const showSuggestions = isSlotBoundary && pair.length > 0

            return (
              <Fragment key={post.post_id}>
                <FaithPostCard
                  post={post}
                  userId={userId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                {showSuggestions && <FollowSuggestionCard people={pair} />}
              </Fragment>
            )
          })}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-3 text-xs text-gold-500 hover:text-gold-400 transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
              ) : (
                'Load more'
              )}
            </button>
          )}
        </div>
      )}

      <PostComposer
        isOpen={composerVisible || !!editingPost}
        onClose={closeComposer}
        onPosted={handlePosted}
        userId={userId}
        editPost={editingPost ?? undefined}
        onUpdated={handleUpdated}
      />
    </section>
  )
}

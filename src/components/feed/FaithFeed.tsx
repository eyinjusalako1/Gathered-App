'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FaithPostCard, { FaithPost } from './FaithPostCard'
import FirstPostPrompt from './FirstPostPrompt'
import StarterFeed from './StarterFeed'
import FeedOnboardingOverlay from './FeedOnboardingOverlay'
import PostComposer from './PostComposer'
import { Loader2 } from 'lucide-react'

const PAGE_SIZE = 10

interface Props {
  userId: string
}

export default function FaithFeed({ userId }: Props) {
  const [posts, setPosts] = useState<FaithPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hasPosts, setHasPosts] = useState<boolean | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const offsetRef = useRef(0)

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

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchFeed(offsetRef.current, true)
  }

  const handlePosted = () => {
    setHasPosts(true)
    offsetRef.current = 0
    setLoading(true)
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
          {posts.map(post => (
            <FaithPostCard key={post.post_id} post={post} />
          ))}

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
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
        userId={userId}
      />
    </section>
  )
}

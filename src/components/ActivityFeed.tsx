'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BookOpen, MessageCircle, UserPlus, Calendar, Users } from 'lucide-react'
import { Skeleton, SkeletonText, SkeletonAvatar } from '@/components/ui/Skeleton'

interface ActivityItem {
  id: string
  type: 'message' | 'devotion' | 'joined' | 'event'
  actor: { id: string; name: string; avatar_url: string | null }
  group: { id: string; name: string }
  preview: string | null
  created_at: string
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function actionText(item: ActivityItem): string {
  switch (item.type) {
    case 'devotion': return `shared a devotion in ${item.group.name}`
    case 'message':  return `sent a message in ${item.group.name}`
    case 'joined':   return `joined ${item.group.name}`
    case 'event':    return `created a hangout in ${item.group.name}`
  }
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'devotion': return <BookOpen className={cls} />
    case 'message':  return <MessageCircle className={cls} />
    case 'joined':   return <UserPlus className={cls} />
    case 'event':    return <Calendar className={cls} />
  }
}

const iconColour: Record<ActivityItem['type'], string> = {
  devotion: 'text-gold-400 bg-gold-500/10',
  message:  'text-sky-400 bg-sky-500/10',
  joined:   'text-emerald-400 bg-emerald-500/10',
  event:    'text-violet-400 bg-violet-500/10',
}

interface Props {
  userId: string
  groupIds: string[]
}

const COLLAPSED_COUNT = 3

export default function ActivityFeed({ userId, groupIds }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const groupIdsRef = useRef(groupIds)

  // Keep ref in sync so the realtime handler always sees current group list
  useEffect(() => { groupIdsRef.current = groupIds }, [groupIds])

  // Initial fetch
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const res = await fetch('/api/activity/feed', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setItems(data.items || [])
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  // Realtime: prepend new group_chat_messages from user's groups
  useEffect(() => {
    if (!userId || groupIds.length === 0) return

    const channel = supabase
      .channel(`activity-feed:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_chat_messages' },
        async (payload) => {
          const row = payload.new as any
          // Only care about groups the user belongs to, not their own messages
          if (!groupIdsRef.current.includes(row.group_id)) return
          if (row.user_id === userId) return

          // Fetch actor profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .eq('id', row.user_id)
            .single()

          const { data: group } = await supabase
            .from('fellowship_groups')
            .select('id, name')
            .eq('id', row.group_id)
            .single()

          const newItem: ActivityItem = {
            id: `msg-${row.id}`,
            type: row.type === 'devotion_share' ? 'devotion' : 'message',
            actor: {
              id: row.user_id,
              name: (profile as any)?.name?.trim() || 'Someone',
              avatar_url: (profile as any)?.avatar_url || null,
            },
            group: { id: row.group_id, name: (group as any)?.name || 'a group' },
            preview: row.content ? String(row.content).slice(0, 80) : null,
            created_at: row.created_at,
          }

          setItems((prev) => {
            // Avoid duplicates
            if (prev.some((i) => i.id === newItem.id)) return prev
            return [newItem, ...prev].slice(0, 10)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, groupIds.length])

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Recent activity</h2>
        <div className="rounded-2xl border border-white/10 bg-navy-900/40 divide-y divide-white/5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <div className="relative shrink-0">
                <SkeletonAvatar size="sm" />
                <Skeleton className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full" />
              </div>
              <div className="flex-1 space-y-1.5">
                <SkeletonText width="3/4" />
                <SkeletonText width="1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Recent activity</h2>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-navy-900/40 p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400">
            No recent activity yet — invite friends to get started
          </p>
          <button
            onClick={() => router.push('/fellowship')}
            className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
          >
            Browse groups
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-navy-900/40 divide-y divide-white/5 overflow-hidden">
          {(expanded ? items : items.slice(0, COLLAPSED_COUNT)).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(`/chat/${item.group.id}`)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors"
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center overflow-hidden">
                  {item.actor.avatar_url ? (
                    <img
                      src={item.actor.avatar_url}
                      alt={item.actor.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-semibold text-gold-500">
                      {getInitials(item.actor.name)}
                    </span>
                  )}
                </div>
                {/* Type badge */}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-navy-900 ${iconColour[item.type]}`}
                >
                  <ActivityIcon type={item.type} />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 leading-snug">
                  <span className="font-semibold">{item.actor.name}</span>
                  {' '}
                  <span className="text-slate-400">{actionText(item)}</span>
                </p>
                {item.preview && item.type !== 'joined' && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{item.preview}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-0.5">{timeAgo(item.created_at)}</p>
              </div>
            </button>
          ))}

          {/* Expand / collapse toggle */}
          {items.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full px-4 py-2.5 text-xs text-gold-500 hover:text-gold-400 hover:bg-white/5 transition-colors text-left"
            >
              {expanded
                ? 'Show less ↑'
                : `See more activity → (${items.length - COLLAPSED_COUNT} more)`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

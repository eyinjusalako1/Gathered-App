'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

/**
 * Polls /api/chat/unread-total every 30 s and returns the aggregate count.
 * Used by the bottom nav to show a badge on the Chat tab.
 *
 * WHY polling and not Realtime: the bottom nav renders on every page. Keeping
 * a Realtime subscription alive everywhere would open one channel per table
 * per session. Polling at 30 s is acceptable for a badge (not a chat inbox)
 * and keeps the connection count low.
 * TODO: replace with a server-sent Realtime broadcast when the infra supports it.
 */
export function useUnreadChat() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat/unread-total', {
        headers: {
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
      })
      if (res.ok) {
        const json = await res.json()
        setUnreadCount(json.count ?? 0)
      }
    } catch {
      // Silently fail — a missing badge is acceptable; a crash is not.
    }
  }, [user?.id])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { unreadCount }
}

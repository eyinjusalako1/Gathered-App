import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export interface ActivityItem {
  id: string
  type: 'message' | 'devotion' | 'joined' | 'event'
  actor: { id: string; name: string; avatar_url: string | null }
  group: { id: string; name: string }
  preview: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = authUser.userId

    // 1. Get user's active group IDs
    const { data: memberships } = await supabaseServer
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    const groupIds = (memberships || []).map((m: any) => m.group_id)
    if (groupIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // 2. Parallel queries across sources
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const [messagesRes, joinsRes, eventsRes] = await Promise.all([
      supabaseServer
        .from('group_chat_messages')
        .select('id, group_id, user_id, content, type, created_at')
        .in('group_id', groupIds)
        .neq('user_id', userId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(40),

      supabaseServer
        .from('group_memberships')
        .select('id, group_id, user_id, joined_at')
        .in('group_id', groupIds)
        .neq('user_id', userId)
        .eq('status', 'active')
        .gte('joined_at', cutoff)
        .order('joined_at', { ascending: false })
        .limit(20),

      supabaseServer
        .from('events')
        .select('id, group_id, title, created_by, created_at')
        .in('group_id', groupIds)
        .neq('created_by', userId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // 3. Collect all actor IDs and group IDs to batch-fetch
    const actorIds = new Set<string>()
    const groupIdSet = new Set<string>(groupIds)

    ;(messagesRes.data || []).forEach((r: any) => actorIds.add(r.user_id))
    ;(joinsRes.data || []).forEach((r: any) => actorIds.add(r.user_id))
    ;(eventsRes.data || []).forEach((r: any) => actorIds.add(r.created_by))

    const [profilesRes, groupsRes] = await Promise.all([
      actorIds.size > 0
        ? supabaseServer
            .from('user_profiles')
            .select('id, name, email, avatar_url')
            .in('id', Array.from(actorIds))
        : Promise.resolve({ data: [] }),

      supabaseServer
        .from('fellowship_groups')
        .select('id, name')
        .in('id', Array.from(groupIdSet)),
    ])

    const profileMap = new Map(
      (profilesRes.data || []).map((p: any) => [p.id, p])
    )
    const groupMap = new Map(
      (groupsRes.data || []).map((g: any) => [g.id, g])
    )

    const getActor = (id: string) => {
      const p = profileMap.get(id) as any
      return {
        id,
        name: p?.name?.trim() || (p as any)?.email?.split('@')[0] || 'Someone',
        avatar_url: p?.avatar_url || null,
      }
    }
    const getGroup = (id: string) => {
      const g = groupMap.get(id) as any
      return { id, name: g?.name || 'a group' }
    }

    // 4. Map to unified ActivityItem
    const items: ActivityItem[] = []

    for (const row of messagesRes.data || []) {
      items.push({
        id: `msg-${row.id}`,
        type: row.type === 'devotion_share' ? 'devotion' : 'message',
        actor: getActor(row.user_id),
        group: getGroup(row.group_id),
        preview: row.content ? String(row.content).slice(0, 80) : null,
        created_at: row.created_at,
      })
    }

    for (const row of joinsRes.data || []) {
      items.push({
        id: `join-${row.id}`,
        type: 'joined',
        actor: getActor(row.user_id),
        group: getGroup(row.group_id),
        preview: null,
        created_at: row.joined_at,
      })
    }

    for (const row of eventsRes.data || []) {
      items.push({
        id: `event-${row.id}`,
        type: 'event',
        actor: getActor(row.created_by),
        group: getGroup(row.group_id),
        preview: row.title || null,
        created_at: row.created_at,
      })
    }

    // 5. Sort by recency, return top 10
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ items: items.slice(0, 10) })
  } catch (error: any) {
    console.error('Error in GET /api/activity/feed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

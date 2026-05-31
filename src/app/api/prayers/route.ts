import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendPushToUsers } from '@/lib/notifications'

const VALID_CATEGORIES = new Set(['for_someone_else', 'for_myself', 'praise_report'])

export async function POST(req: NextRequest) {
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content, category = null, is_anonymous = false, group_id = null } = body

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  const trimmed = content.trim()
  if (trimmed.length < 1 || trimmed.length > 1000) {
    return NextResponse.json({ error: 'content must be 1–1000 characters' }, { status: 400 })
  }

  if (category !== null && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (group_id !== null && typeof group_id !== 'string') {
    return NextResponse.json({ error: 'Invalid group_id' }, { status: 400 })
  }

  // Pre-flight membership check: gives a clean 403 before the RLS INSERT fires.
  // The RLS policy on prayer_requests (Chunk 2 of the migration) is the authoritative guard.
  if (group_id !== null) {
    const { data: membership } = await supabaseServer
      .from('group_memberships')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }
  }

  // WHY user-scoped client: RLS INSERT policy enforces user_id = auth.uid().
  const { data, error } = await auth.client
    .from('prayer_requests')
    .insert({
      user_id:      auth.userId,
      content:      trimmed,
      category:     category ?? null,
      is_anonymous: Boolean(is_anonymous),
      group_id:     group_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('prayer_requests insert error:', error)
    return NextResponse.json({ error: 'Failed to post prayer' }, { status: 500 })
  }

  // Push notifications for group prayers — same pattern as group chat messages.
  // Awaited before returning so Vercel doesn't terminate the function early.
  // Errors are caught and logged — never affect the HTTP response.
  if (group_id) {
    try {
      const [{ data: group }, { data: otherMembers }] = await Promise.all([
        supabaseServer
          .from('fellowship_groups')
          .select('name')
          .eq('id', group_id)
          .single(),
        supabaseServer
          .from('group_memberships')
          .select('user_id')
          .eq('group_id', group_id)
          .eq('status', 'active')
          .neq('user_id', auth.userId),
      ])

      const recipientIds = (otherMembers ?? []).map((m: any) => m.user_id)
      if (recipientIds.length > 0) {
        const groupName = group?.name ?? 'your group'
        await sendPushToUsers(recipientIds, {
          title: Boolean(is_anonymous)
            ? `Anonymous prayer in ${groupName}`
            : `New prayer in ${groupName}`,
          body: Boolean(is_anonymous)
            ? 'Someone shared a prayer'
            : trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
          url: `/groups/${group_id}/prayers`,
        })
      }
    } catch (pushErr: any) {
      console.error('[push] Group prayer notification failed:', pushErr?.message)
    }
  }

  return NextResponse.json({ prayer: data }, { status: 201 })
}

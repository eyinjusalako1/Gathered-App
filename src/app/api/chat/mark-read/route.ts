import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

/**
 * POST /api/chat/mark-read
 * Body: { type: 'group' | 'dm', id: string }
 *
 * Sets last_read_at = NOW() for the calling user in the relevant junction table.
 * Called fire-and-forget from chat pages on mount — the response is intentionally
 * ignored by the client so it never delays opening the chat UI.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, id } = await req.json()
  const now = new Date().toISOString()

  if (type === 'group') {
    // WHY: service role bypasses RLS — the user can only update their own row
    // because we filter by both group_id AND user_id.
    await supabaseServer
      .from('group_memberships')
      .update({ last_read_at: now })
      .eq('group_id', id)
      .eq('user_id', authUser.userId)
  } else if (type === 'dm') {
    await supabaseServer
      .from('dm_thread_members')
      .update({ last_read_at: now })
      .eq('thread_id', id)
      .eq('user_id', authUser.userId)
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

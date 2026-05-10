import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'
import { getBlockedUserIds } from '@/lib/blocking'

/**
 * GET /api/chat/dm/threads
 *
 * Previously: 4 sequential Supabase queries + one extra query per thread (N+1).
 * Now: one RPC call that does all joins in Postgres, then a client-side filter
 * for blocked users (blocking data isn't in the chat schema so stays here).
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data, error }, blockedUserIds] = await Promise.all([
    supabaseServer.rpc('get_dm_chat_list', { p_user_id: authUser.userId }),
    getBlockedUserIds(authUser.userId),
  ])

  if (error) {
    console.error('get_dm_chat_list RPC error:', error)
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }

  // WHY: blocking is enforced here rather than in the RPC because the blocked_users
  // table lives outside the chat schema. Keeping it in application code avoids
  // coupling the RPC to a table it shouldn't know about.
  const threads = (data ?? []).filter((t: { other_user_id: string }) => !blockedUserIds.has(t.other_user_id))

  return NextResponse.json({ threads })
}

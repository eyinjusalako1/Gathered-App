import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

/**
 * GET /api/chat/group-list
 *
 * Replaces the N+1 pattern in chat/page.tsx (getUserJoinedGroups + one fetch
 * per group). A single Postgres RPC returns every group the user belongs to,
 * with last message text and unread count in one round trip.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseServer.rpc('get_group_chat_list', {
    p_user_id: authUser.userId,
  })

  if (error) {
    console.error('get_group_chat_list RPC error:', error)
    return NextResponse.json({ error: 'Failed to load group list' }, { status: 500 })
  }

  return NextResponse.json({ groups: data ?? [] })
}

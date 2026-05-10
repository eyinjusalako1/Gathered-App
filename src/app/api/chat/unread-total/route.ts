import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

/**
 * GET /api/chat/unread-total
 *
 * Returns { count: number } — total unread messages across all groups and DMs.
 * Polled every 30 s by the bottom nav badge hook. Returns 0 on any error so
 * the badge simply disappears rather than showing stale data.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    // Not authenticated — no badge, no error
    return NextResponse.json({ count: 0 })
  }

  const { data, error } = await supabaseServer.rpc('get_total_unread_count', {
    p_user_id: authUser.userId,
  })

  if (error) {
    console.error('get_total_unread_count RPC error:', error)
    return NextResponse.json({ count: 0 })
  }

  return NextResponse.json({ count: data ?? 0 })
}

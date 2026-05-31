import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'praying'
  if (status !== 'praying' && status !== 'answered') {
    return NextResponse.json({ error: 'status must be praying or answered' }, { status: 400 })
  }

  // WHY service role client: get_group_prayer_wall is SECURITY DEFINER and takes
  // p_user_id explicitly — it enforces membership, anonymity, and has_prayed/is_own
  // server-side. Non-members receive an empty result set.
  const { data, error } = await supabaseServer.rpc('get_group_prayer_wall', {
    p_user_id: authUser.userId,
    p_group_id: params.id,
    p_status: status,
  })

  if (error) {
    console.error('get_group_prayer_wall RPC error:', error)
    return NextResponse.json({ error: 'Failed to fetch prayers' }, { status: 500 })
  }

  return NextResponse.json({ prayers: data ?? [] })
}

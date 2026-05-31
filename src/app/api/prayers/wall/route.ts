import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'praying'
  if (status !== 'praying' && status !== 'answered') {
    return NextResponse.json({ error: 'status must be praying or answered' }, { status: 400 })
  }

  // WHY service role client: get_global_prayer_wall is SECURITY DEFINER and takes
  // p_user_id explicitly, so it enforces anonymity and has_prayed/is_own itself.
  const { data, error } = await supabaseServer.rpc('get_global_prayer_wall', {
    p_user_id: authUser.userId,
    p_status: status,
  })

  if (error) {
    console.error('get_global_prayer_wall RPC error:', error)
    return NextResponse.json({ error: 'Failed to fetch prayers' }, { status: 500 })
  }

  return NextResponse.json({ prayers: data ?? [] })
}

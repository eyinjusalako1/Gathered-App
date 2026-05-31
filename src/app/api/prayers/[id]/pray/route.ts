import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // WHY user-scoped client: toggle_prayer_interaction is SECURITY DEFINER and
  // uses auth.uid() internally to identify the caller. The JWT must be present
  // in the request for auth.uid() to resolve correctly inside the function.
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data, error } = await auth.client.rpc('toggle_prayer_interaction', {
    p_prayer_id: id,
  })

  if (error) {
    console.error('toggle_prayer_interaction RPC error:', error)
    return NextResponse.json({ error: 'Failed to toggle prayer' }, { status: 500 })
  }

  // RPC returns a single-row result set; destructure explicitly for a stable contract
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    prayed_count: row?.prayed_count ?? 0,
    has_prayed:   row?.has_prayed   ?? false,
  })
}

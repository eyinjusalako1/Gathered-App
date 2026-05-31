import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const { status } = body

  if (status !== 'praying' && status !== 'answered') {
    return NextResponse.json({ error: 'status must be praying or answered' }, { status: 400 })
  }

  // WHY user-scoped client: RLS UPDATE policy is the primary author guard.
  // Explicit .eq('user_id') is defense-in-depth alongside RLS — same pattern as DELETE.
  // The guard_prayer_request_update trigger auto-sets answered_at on the DB side.
  const { error, count } = await auth.client
    .from('prayer_requests')
    .update({ status }, { count: 'exact' })
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('prayer_requests status update error:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

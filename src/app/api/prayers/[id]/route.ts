import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // WHY user-scoped client: RLS DELETE policy (user_id = auth.uid()) is the primary
  // guard. The explicit .eq('user_id') is defense-in-depth — if RLS ever has a bug,
  // the route still won't allow cross-user deletes.
  const { error, count } = await auth.client
    .from('prayer_requests')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('prayer_requests delete error:', error)
    return NextResponse.json({ error: 'Failed to delete prayer' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

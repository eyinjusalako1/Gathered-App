import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient } from '@/lib/server-auth-utils'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // WHY user-scoped client: RLS DELETE policy (user_id = auth.uid()) is the primary
  // guard. The explicit .eq('user_id') is defense-in-depth — same pattern as
  // prayer DELETE in prayers/[id]/route.ts.
  const { error, count } = await auth.client
    .from('prayer_comments')
    .delete({ count: 'exact' })
    .eq('id', params.commentId)
    .eq('prayer_id', params.id)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('prayer_comments delete error:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

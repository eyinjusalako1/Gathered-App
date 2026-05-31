import { NextRequest, NextResponse } from 'next/server'
import { createUserSupabaseClient, getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // WHY service role client: get_prayer_comments is SECURITY DEFINER and verifies
  // the caller can see the parent prayer before returning any comments.
  const { data, error } = await supabaseServer.rpc('get_prayer_comments', {
    p_user_id:   authUser.userId,
    p_prayer_id: params.id,
  })

  if (error) {
    console.error('get_prayer_comments RPC error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await createUserSupabaseClient(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content } = body

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  const trimmed = content.trim()
  if (trimmed.length < 1 || trimmed.length > 500) {
    return NextResponse.json({ error: 'content must be 1–500 characters' }, { status: 400 })
  }

  // Explicit check before RLS fires — cleaner error message than an RLS violation.
  const { data: prayer } = await supabaseServer
    .from('prayer_requests')
    .select('group_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!prayer) {
    return NextResponse.json({ error: 'Prayer not found' }, { status: 404 })
  }
  if (prayer.group_id === null) {
    return NextResponse.json({ error: 'Comments are not available on global prayers' }, { status: 400 })
  }

  // WHY user-scoped client: RLS INSERT policy enforces user_id = auth.uid() and
  // that the parent prayer's group has the caller as an active member.
  const { data, error } = await auth.client
    .from('prayer_comments')
    .insert({ prayer_id: params.id, user_id: auth.userId, content: trimmed })
    .select('id, content, created_at')
    .single()

  if (error) {
    console.error('prayer_comments insert error:', error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let target_user_id: string
  try {
    ;({ user_id: target_user_id } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!target_user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const followerId = authUser.userId

  if (followerId === target_user_id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  // Check existing follow
  const { data: existing } = await supabaseServer
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', target_user_id)
    .maybeSingle()

  if (existing) {
    // Unfollow
    const { error } = await supabaseServer
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', target_user_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'unfollowed' })
  }

  // Follow
  const { error } = await supabaseServer
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: target_user_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'followed' })
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let post_id: string, reaction_type: string
  try {
    ;({ post_id, reaction_type } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!post_id || !reaction_type) {
    return NextResponse.json({ error: 'post_id and reaction_type required' }, { status: 400 })
  }

  const ALLOWED = ['amen', 'heart', 'fire']
  if (!ALLOWED.includes(reaction_type)) {
    return NextResponse.json({ error: 'Invalid reaction_type' }, { status: 400 })
  }

  const userId = authUser.userId

  // Check if user already has this exact reaction
  const { data: existing } = await supabaseServer
    .from('faith_reactions')
    .select('post_id')
    .eq('post_id', post_id)
    .eq('user_id', userId)
    .eq('reaction_type', reaction_type)
    .maybeSingle()

  if (existing) {
    // Toggle off
    const { error } = await supabaseServer
      .from('faith_reactions')
      .delete()
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .eq('reaction_type', reaction_type)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'removed' })
  }

  // Remove any prior reaction on this post (one reaction per user per post)
  await supabaseServer
    .from('faith_reactions')
    .delete()
    .eq('post_id', post_id)
    .eq('user_id', userId)

  // Insert new reaction
  const { error } = await supabaseServer
    .from('faith_reactions')
    .insert({ post_id, user_id: userId, reaction_type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'added' })
}

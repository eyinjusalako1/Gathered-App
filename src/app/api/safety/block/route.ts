import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'
import { getBlockDirection } from '@/lib/blocking'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const otherUserId = searchParams.get('user_id')
    if (!otherUserId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const direction = await getBlockDirection(authUser.userId, otherUserId)
    return NextResponse.json({
      blocked: direction !== 'none',
      direction,
    })
  } catch (error: any) {
    console.error('Error in GET /api/safety/block:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { blocked_user_id, action } = body || {}

    if (!blocked_user_id) {
      return NextResponse.json({ error: 'blocked_user_id is required' }, { status: 400 })
    }

    if (blocked_user_id === authUser.userId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 })
    }

    if (action === 'unblock') {
      const { error } = await supabaseServer
        .from('blocked_users')
        .delete()
        .eq('blocker_id', authUser.userId)
        .eq('blocked_id', blocked_user_id)

      if (error) {
        console.error('Error unblocking user:', error)
        return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 })
      }

      return NextResponse.json({ blocked: false })
    }

    const { error } = await supabaseServer
      .from('blocked_users')
      .upsert(
        {
          blocker_id: authUser.userId,
          blocked_id: blocked_user_id,
        },
        { onConflict: 'blocker_id,blocked_id' }
      )

    if (error) {
      console.error('Error blocking user:', error)
      return NextResponse.json({ error: 'Failed to block user' }, { status: 500 })
    }

    return NextResponse.json({ blocked: true })
  } catch (error: any) {
    console.error('Error in POST /api/safety/block:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}




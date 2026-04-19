import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { subscription } = body

    if (!subscription || typeof subscription !== 'object' || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const { error } = await supabaseServer
      .from('push_subscriptions')
      .upsert(
        { user_id: authUser.userId, subscription },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Error saving push subscription:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/notifications/subscribe:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

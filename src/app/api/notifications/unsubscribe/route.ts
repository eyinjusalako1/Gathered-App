import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth-utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseServer
      .from('push_subscriptions')
      .delete()
      .eq('user_id', authUser.userId)

    if (error) {
      console.error('Error deleting push subscription:', error)
      return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/notifications/unsubscribe:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

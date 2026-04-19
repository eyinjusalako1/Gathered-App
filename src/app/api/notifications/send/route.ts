import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseServer } from '@/lib/supabaseServer'

function initWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'hello@gathered-app.com'}`,
    pub,
    priv
  )
  return true
}

export async function POST(req: NextRequest) {
  try {
    if (!initWebPush()) {
      return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
    }

    // Protect with CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const secret = process.env.CRON_SECRET
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { user_id, title, body: notifBody, url } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id and title are required' }, { status: 400 })
    }

    const { data: row, error } = await supabaseServer
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'No subscription found for user' }, { status: 404 })
    }

    try {
      await webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify({ title, body: notifBody || '', url: url || '/dashboard' })
      )
    } catch (pushError: any) {
      // Subscription expired or invalid — clean it up
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await supabaseServer
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user_id)
        return NextResponse.json({ error: 'Subscription expired, removed' }, { status: 410 })
      }
      throw pushError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/notifications/send:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

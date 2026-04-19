import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  try {
    if (!initWebPush()) {
      return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
    }

    // Vercel cron sends Authorization: Bearer <CRON_SECRET>
    const authHeader = req.headers.get('authorization')
    const secret = process.env.CRON_SECRET
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: subscriptions, error } = await supabaseServer
      .from('push_subscriptions')
      .select('user_id, subscription')

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscribers' })
    }

    const payload = JSON.stringify({
      title: "Don't lose your streak 🔥",
      body: "Today's word is waiting. Keep your faith journey going.",
      url: '/devotions',
    })

    const staleIds: string[] = []
    let sent = 0

    await Promise.allSettled(
      subscriptions.map(async (row) => {
        try {
          await webpush.sendNotification(
            row.subscription as webpush.PushSubscription,
            payload
          )
          sent++
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(row.user_id)
          } else {
            console.warn(`Push failed for user ${row.user_id}:`, err.message)
          }
        }
      })
    )

    // Clean up expired subscriptions
    if (staleIds.length > 0) {
      await supabaseServer
        .from('push_subscriptions')
        .delete()
        .in('user_id', staleIds)
    }

    return NextResponse.json({ sent, stale_removed: staleIds.length })
  } catch (error: any) {
    console.error('Error in GET /api/cron/streak-reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

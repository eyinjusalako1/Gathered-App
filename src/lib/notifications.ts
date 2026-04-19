import webpush from 'web-push'
import { supabaseServer } from './supabaseServer'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'hello@gathered-app.com'}`,
    publicKey,
    privateKey
  )
  vapidConfigured = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

/**
 * Send a push notification to a single user.
 * Silently no-ops if the user has no subscription.
 * Deletes stale subscriptions (410/404 from the push service).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureVapid()
  const { data: row } = await supabaseServer
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single()

  if (!row?.subscription) return

  try {
    await webpush.sendNotification(
      row.subscription as webpush.PushSubscription,
      JSON.stringify(payload)
    )
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or revoked — remove it
      await supabaseServer
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
    }
    // All other errors are swallowed — a failed push must never break the caller
  }
}

/**
 * Send a push notification to multiple users in parallel.
 * All failures are isolated; one bad subscription won't block others.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)))
}

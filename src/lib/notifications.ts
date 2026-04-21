import webpush from 'web-push'
import { supabaseServer } from './supabaseServer'

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.error(
      '[push] VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel environment variables'
    )
    return false
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'hello@gathered-app.com'}`,
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
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
  if (!ensureVapid()) return

  const { data: row, error: fetchError } = await supabaseServer
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected when user has no subscription)
    console.error(`[push] Failed to fetch subscription for user ${userId}:`, fetchError.message)
    return
  }

  if (!row?.subscription) return // No subscription — user hasn't enabled push

  try {
    await webpush.sendNotification(
      row.subscription as webpush.PushSubscription,
      JSON.stringify(payload)
    )
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or revoked — clean it up
      console.warn(`[push] Subscription expired for user ${userId}, removing`)
      await supabaseServer.from('push_subscriptions').delete().eq('user_id', userId)
    } else {
      console.error(`[push] Failed to send notification to user ${userId}:`, err.message, `(status: ${err.statusCode})`)
    }
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

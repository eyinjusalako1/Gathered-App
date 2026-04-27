'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Listens for NAVIGATE_FROM_NOTIFICATION messages posted by the service worker
 * when the user taps a push notification while the app is already open.
 * The SW focuses the existing window and posts the message; this component
 * calls router.push() so Next.js handles the navigation client-side.
 */
export default function NotificationNavigator() {
  const router = useRouter()

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const handleMessage = (event: MessageEvent) => {
      console.log('[NotificationNavigator] message received', event.data)
      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION' && event.data?.url) {
        console.log('[NotificationNavigator] navigating to', event.data.url)
        router.push(event.data.url)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [router])

  return null
}

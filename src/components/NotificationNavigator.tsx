'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function writeDebugEntry(entry: { ts: number; source: string; msg: string; data: unknown }) {
  try {
    const req = indexedDB.open('gathered-debug', 1)
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => {
      try {
        ;(e.target as IDBOpenDBRequest).result
          .transaction('logs', 'readwrite')
          .objectStore('logs')
          .add(entry)
      } catch (_) {}
    }
  } catch (_) {}
}

function nnLog(msg: string, data?: unknown) {
  writeDebugEntry({ ts: Date.now(), source: 'NN', msg, data: data ?? null })
}

export default function NotificationNavigator() {
  const router = useRouter()

  useEffect(() => {
    nnLog('NotificationNavigator mounted', { swAvailable: 'serviceWorker' in navigator })

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      nnLog('serviceWorker not available — bailing')
      return
    }

    const handleMessage = (event: MessageEvent) => {
      console.log('[NotificationNavigator] message received', event.data)
      nnLog('message received from SW', event.data)

      if (event.data?.type === 'DEBUG_LOG' && event.data?.entry) {
        writeDebugEntry(event.data.entry)
      }

      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION' && event.data?.url) {
        console.log('[NotificationNavigator] navigating to', event.data.url)
        nnLog('calling router.push', { url: event.data.url })
        router.push(event.data.url)
        nnLog('router.push called (synchronous return — actual navigation is async)')
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    nnLog('message listener registered')

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      nnLog('message listener removed (unmount)')
    }
  }, [router])

  return null
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Gathered', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Gathered'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    // url lives inside data so the notificationclick handler can read it
    // via event.notification.data.url regardless of how it was delivered.
    data: payload.data || { url: '/dashboard' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        // App is already open — focus the first window and ask it to navigate.
        // This lets Next.js router.push() handle the transition (preserving
        // layout, scroll restoration, etc.) rather than a hard reload.
        const client = clientList[0]
        client.postMessage({ type: 'NAVIGATE_FROM_NOTIFICATION', url })
        return client.focus()
      }

      // App is not open — open a new window directly at the target URL.
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

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
    data: payload.data || { url: '/dashboard' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notificationclick fired', {
    url: event.notification.data?.url,
    data: event.notification.data,
  })

  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('[SW] clients found:', clientList.length, clientList.map(c => c.url))

      if (clientList.length > 0) {
        const client = clientList[0]
        console.log('[SW] posting NAVIGATE_FROM_NOTIFICATION to client:', client.url)
        client.postMessage({ type: 'NAVIGATE_FROM_NOTIFICATION', url })
        return client.focus()
      }

      console.log('[SW] no open clients — calling openWindow:', url)
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

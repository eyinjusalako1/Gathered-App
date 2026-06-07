// ─── Debug logger — posts to window clients so they can write to IndexedDB ───
// iOS Safari silently drops IndexedDB writes made from SW context. Routing
// through postMessage means the page-context handler does the actual write,
// which is reliable on iOS.
function swPostLog(msg, data) {
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const entry = { ts: Date.now(), source: 'SW', msg, data: data !== undefined ? JSON.parse(JSON.stringify(data)) : null }
    clientList.forEach((client) => client.postMessage({ type: 'DEBUG_LOG', entry }))
  }).catch(() => {})
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const notifData = { url: event.notification.data?.url, data: event.notification.data }
  console.log('[SW] notificationclick fired', notifData)
  swPostLog('notificationclick fired', notifData)

  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const clientUrls = clientList.map(c => c.url)
      console.log('[SW] clients found:', clientList.length, clientUrls)
      swPostLog('clients.matchAll result', { count: clientList.length, urls: clientUrls })

      if (clientList.length > 0) {
        const client = clientList[0]
        console.log('[SW] posting NAVIGATE_FROM_NOTIFICATION to client:', client.url)
        swPostLog('posting NAVIGATE_FROM_NOTIFICATION', { targetClient: client.url, url })
        client.postMessage({ type: 'NAVIGATE_FROM_NOTIFICATION', url })
        return client.focus().then(() => {
          swPostLog('client.focus() resolved')
        }).catch((err) => {
          swPostLog('client.focus() rejected', { err: String(err) })
        })
      }

      console.log('[SW] no open clients — calling openWindow:', url)
      swPostLog('no open clients — calling openWindow', { url })
      if (clients.openWindow) {
        return clients.openWindow(url).then((win) => {
          swPostLog('openWindow resolved', { didGetWindowClient: !!win, winUrl: win?.url })
        }).catch((err) => {
          swPostLog('openWindow rejected', { err: String(err) })
        })
      }
      swPostLog('clients.openWindow not available')
    })
  )
})

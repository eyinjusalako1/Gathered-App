// ─── Debug logger — writes to IndexedDB so /debug page can read on-device ───
const _DB = 'gathered-debug'
const _STORE = 'logs'

function swLog(msg, data) {
  try {
    const req = indexedDB.open(_DB, 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => {
      try {
        const entry = { ts: Date.now(), source: 'SW', msg, data: data !== undefined ? JSON.parse(JSON.stringify(data)) : null }
        e.target.result.transaction(_STORE, 'readwrite').objectStore(_STORE).add(entry)
      } catch (_) {}
    }
  } catch (_) {}
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
  swLog('notificationclick fired', notifData)

  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const clientUrls = clientList.map(c => c.url)
      console.log('[SW] clients found:', clientList.length, clientUrls)
      swLog('clients.matchAll result', { count: clientList.length, urls: clientUrls })

      if (clientList.length > 0) {
        const client = clientList[0]
        console.log('[SW] posting NAVIGATE_FROM_NOTIFICATION to client:', client.url)
        swLog('posting NAVIGATE_FROM_NOTIFICATION', { targetClient: client.url, url })
        client.postMessage({ type: 'NAVIGATE_FROM_NOTIFICATION', url })
        return client.focus().then(() => {
          swLog('client.focus() resolved')
        }).catch((err) => {
          swLog('client.focus() rejected', { err: String(err) })
        })
      }

      console.log('[SW] no open clients — calling openWindow:', url)
      swLog('no open clients — calling openWindow', { url })
      if (clients.openWindow) {
        return clients.openWindow(url).then((win) => {
          swLog('openWindow resolved', { didGetWindowClient: !!win, winUrl: win?.url })
        }).catch((err) => {
          swLog('openWindow rejected', { err: String(err) })
        })
      }
      swLog('clients.openWindow not available')
    })
  )
})

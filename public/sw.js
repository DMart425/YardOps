// YardOps service worker — handles push notifications.
// This file runs in the background on the user's device.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Receive a push from the server.
self.addEventListener('push', (event) => {
  let data = { title: 'YardOps', body: 'You have a new update', url: '/today' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // payload wasn't JSON; use defaults
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'yardops-default',
    data: { url: data.url || '/today' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// When user taps the notification, focus or open the app at the given URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/today'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

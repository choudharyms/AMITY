/* AaharSetu Web Push Service Worker Extension */

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'AaharSetu Food Rescue',
        body: event.data.text() || 'Emergency food rescue update received.',
      };
    }
  }

  const title = data.title || 'AaharSetu Emergency Alert';
  const options = {
    body: data.body || 'New operational update in your food rescue network.',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'aaharsetu-rescue-alert',
    renotify: true,
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'open', title: 'Open AaharSetu' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

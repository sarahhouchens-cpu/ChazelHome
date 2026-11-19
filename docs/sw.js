// HomeIQ service worker: shows push notifications and opens the app when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try {
    const json = event.data ? event.data.json() : {};
    msg = json.data || json.notification || json;
  } catch {
    msg = { body: event.data ? event.data.text() : '' };
  }
  const title = msg.title || 'HomeIQ';
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: msg.tag || undefined,
    data: { url: msg.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) {
      if ('focus' in w) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

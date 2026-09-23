// Service worker for Precision Electronics Repair workshop app

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'Precision Electronics Repair', body: 'New activity', url: '/workshop.html' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  // Tell any open workshop page, so it can flash and sound until acknowledged.
  const tellPages = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    list.forEach(c => c.postMessage({ type: 'workshop-alert', title: data.title, body: data.body, url: data.url }));
  });
  event.waitUntil(Promise.all([tellPages,
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Each alert gets its own tag. A shared tag made a new alert silently
      // replace the last one in the tray, with no sound or pop-up.
      tag: data.tag || ('per-' + Date.now()),
      renotify: true,
      // Stays on screen until you dismiss it.
      requireInteraction: true,
      data: { url: data.url || '/workshop.html' }
    })
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/workshop.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('workshop.html') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

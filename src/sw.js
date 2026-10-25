import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notificações push (alertas da Arca)
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'Arca', {
      body: d.detalhe || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { link: d.link || '/#/hoje' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/#/hoje';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c) { c.navigate(link); return c.focus(); } }
      return self.clients.openWindow(link);
    })
  );
});

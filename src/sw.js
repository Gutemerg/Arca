import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notificações push (avisos da Arca) — fixas, com vibração forte e botões
const COM_FEITO = ['rotina', 'tarefa'];

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: event.data?.text() }; }
  const podeFeito = COM_FEITO.includes(d.tipo) && d.id;
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'Arca', {
      body: d.detalhe || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.tipo && d.id ? `${d.tipo}:${d.id}` : undefined,  // repetições substituem a anterior…
      renotify: true,                                         // …mas vibram de novo
      requireInteraction: true,                               // fica na tela até você mexer
      vibrate: [400, 150, 400, 150, 800],
      timestamp: Date.now(),
      actions: podeFeito
        ? [{ action: 'feito', title: '✓ Feito' }, { action: 'depois', title: 'Lembrar depois' }]
        : [{ action: 'abrir', title: 'Abrir' }],
      data: { link: d.link || '/#/hoje', tipo: d.tipo, id: d.id }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { link = '/#/hoje', tipo, id } = event.notification.data || {};
  // "Lembrar depois": só fecha; a Arca avisa de novo em 10 minutos se continuar pendente
  if (event.action === 'depois') return;
  const destino = event.action === 'feito' && tipo && id ? `/#/hoje?feito=${encodeURIComponent(tipo + ':' + id)}` : link;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c) { c.navigate(destino); return c.focus(); } }
      return self.clients.openWindow(destino);
    })
  );
});

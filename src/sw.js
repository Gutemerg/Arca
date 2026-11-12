import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notificações push (avisos da Arca) — fixas, com vibração forte e botões de resposta.
// "▶ Fazendo" e "✓ Concluí" respondem direto daqui (sem abrir o app), pelo disparador de avisos,
// que confere o código assinado de cada aviso no banco.
const RESPONDER = 'https://arca-avisos.carreiramais.workers.dev/responder';
const COM_RESPOSTA = ['rotina', 'tarefa'];

function opcoes(d, extra = {}) {
  return {
    body: d.detalhe || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tipo && d.id ? `${d.tipo}:${d.id}` : undefined, // repetições substituem a anterior…
    renotify: true,                                        // …mas vibram de novo
    requireInteraction: true,                              // fica na tela até você mexer
    vibrate: [400, 150, 400, 150, 800],
    timestamp: Date.now(),
    data: { link: d.link || '/#/hoje', tipo: d.tipo, id: d.id, dia: d.dia, token: d.token, titulo: d.titulo },
    ...extra
  };
}

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: event.data?.text() }; }
  const responde = COM_RESPOSTA.includes(d.tipo) && d.id && d.token;
  const acoes = !responde
    ? [{ action: 'abrir', title: 'Abrir' }]
    : d.tentativa === 9
      ? [{ action: 'feito', title: '✓ Concluí' }, { action: 'executando', title: '⏳ Ainda fazendo' }]
      : [{ action: 'executando', title: '▶ Fazendo' }, { action: 'feito', title: '✓ Concluí' }];
  event.waitUntil(self.registration.showNotification(d.titulo || 'Arca', opcoes(d, { actions: acoes })));
});

const nomeDe = (dados) => String(dados.titulo || '').replace(/^\S+\s+/, '').replace(/^(\d{2}:\d{2}|Ainda pendente|Concluiu\?)\s·\s/, '');

async function responder(dados, acao) {
  const r = await fetch(RESPONDER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tipo: dados.tipo, id: dados.id, dia: dados.dia, token: dados.token, acao })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.erro || 'falhou');
  return j.nome || nomeDe(dados);
}

async function abrir(destino) {
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of cs) { if ('focus' in c) { await c.navigate(destino).catch(() => {}); return c.focus(); } }
  return self.clients.openWindow(destino);
}

// Avisa as telas abertas do app para recarregar (o item marcado aparece na hora)
async function atualizarTelas() {
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  cs.forEach((c) => c.postMessage({ tipo: 'arca-atualizar' }));
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const dados = n.data || {};
  n.close();
  const { link = '/#/hoje', tipo, id } = dados;

  if ((event.action === 'feito' || event.action === 'executando') && dados.token) {
    event.waitUntil((async () => {
      try {
        const nome = await responder(dados, event.action);
        if (event.action === 'feito') {
          await self.registration.showNotification('✓ Concluído', {
            body: nome, tag: `${tipo}:${id}`, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
            silent: true, requireInteraction: false, data: { link }
          });
          setTimeout(() => self.registration.getNotifications({ tag: `${tipo}:${id}` }).then((l) => l.forEach((x) => x.close())), 5000);
        } else {
          // Fica um lembrete discreto com o botão de concluir
          await self.registration.showNotification('▶ Fazendo agora', {
            body: nome, tag: `${tipo}:${id}`, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
            silent: true, requireInteraction: true, renotify: false,
            actions: [{ action: 'feito', title: '✓ Concluí' }],
            data: dados
          });
        }
        await atualizarTelas();
      } catch {
        // Sem internet ou código vencido: abre o app para marcar por lá
        await abrir(event.action === 'feito' && tipo && id ? `/#/hoje?feito=${encodeURIComponent(tipo + ':' + id)}` : link);
      }
    })());
    return;
  }
  if (event.action === 'feito' && tipo && id) {
    event.waitUntil(abrir(`/#/hoje?feito=${encodeURIComponent(tipo + ':' + id)}`));
    return;
  }
  event.waitUntil(abrir(link));
});

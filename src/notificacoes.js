// Notificações da Arca (Web Push). O celular mostra e o Huawei Saúde espelha no relógio.
import { db, q } from './db.js';

// Chave pública VAPID (pode ficar no código; a privada está só no disparador da Cloudflare)
const VAPID_PUBLICA = 'BNvR4ZSDrhKhIHQzqewXmrZu-qWeGgoXCSQtASOplf5i_wnuoVBk5-6qM7Tw5hwbmljxGZq1oTQ17IuZghbtDsg';

const paraBytes = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

export function suportaNotificacoes() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function estadoNotificacoes() {
  if (!suportaNotificacoes()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueada';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'ativa' : 'desligada';
}

export async function ativarNotificacoes() {
  if (!suportaNotificacoes()) throw new Error('Este navegador não aceita notificações. Instale a Arca na tela inicial e tente de novo.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('As notificações foram bloqueadas. Libere nas configurações do celular.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(VAPID_PUBLICA) }));
  const j = sub.toJSON();
  await q(db.from('push_assinaturas').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }));
}

export async function desativarNotificacoes() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await q(db.from('push_assinaturas').delete().eq('endpoint', sub.endpoint)).catch(() => {});
  await sub.unsubscribe();
}

// Mostra uma notificação de teste na hora (serve para conferir se chega no relógio)
export async function notificacaoTeste() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Arca · teste', { body: 'Se isto apareceu no relógio, está tudo certo.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { link: '/#/hoje' } });
}

// Sincroniza a conta do banco sozinha sempre que você abre (ou volta para) o app.
// Roda em segundo plano, no máximo a cada 15 minutos, sem travar a tela.
import { db, q, tokenAtual } from './db.js';
import { aviso } from './util.js';

const CHAVE = 'arca-sync-banco';
const INTERVALO = 15 * 60000;
let rodando = false;

export async function sincronizarBancoAuto({ forcar = false } = {}) {
  if (rodando || !navigator.onLine) return;
  let ultima = 0;
  try { ultima = Number(localStorage.getItem(CHAVE)) || 0; } catch {}
  if (!forcar && Date.now() - ultima < INTERVALO) return;
  rodando = true;
  try {
    const bancos = await q(db.from('banco_conexoes').select('id').limit(1));
    if (!bancos.length) return;
    try { localStorage.setItem(CHAVE, String(Date.now())); } catch {}
    const token = await tokenAtual();
    const r = await fetch('/api/banco-sync', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) return;
    if (res.novos) aviso(`🏦 ${res.novos} ${res.novos === 1 ? 'lançamento novo' : 'lançamentos novos'} do banco`);
    // Atualiza a tela se ela mostra dados do banco
    const rota = location.hash.replace(/^#\/?/, '').split('?')[0] || 'hoje';
    if (res.novos && ['hoje', 'financas'].includes(rota)) window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    // silencioso: o botão "Sincronizar" em Finanças continua mostrando erros
  } finally {
    rodando = false;
  }
}

// Ao voltar para o app (estava em segundo plano), tenta de novo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.dataset.logado === '1') sincronizarBancoAuto();
});

// Arca — disparador de avisos (Cloudflare Worker com cron a cada 5 minutos).
// Pede ao banco os avisos do momento (public.avisos_pendentes) e envia por Web Push.
// O celular mostra a notificação e o Huawei Saúde espelha no relógio.
//
// Segredos (variáveis do Worker): DATABASE_URL (usuário arca_avisos, só executa as funções de aviso),
// VAPID_PRIVATE_JWK, VAPID_PUBLIC_KEY. Valor público: VAPID_SUBJECT.

const NEON_SQL = (url) => `https://${new URL(url).hostname}/sql`;

async function sql(env, query, params = []) {
  const r = await fetch(NEON_SQL(env.DATABASE_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Neon-Connection-String': env.DATABASE_URL },
    body: JSON.stringify({ query, params })
  });
  if (!r.ok) throw new Error(`Banco respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).rows || [];
}

// ---------- Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) ----------
const enc = new TextEncoder();
const b64u = {
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
};
const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

async function vapidHeader(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u.enc(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:arca@example.com' })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64u.enc(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function encrypt(sub, texto) {
  const uaPublic = b64u.dec(sub.p256dh);
  const authSecret = b64u.dec(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(texto), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));

  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function enviar(aviso, env) {
  const corpo = await encrypt(aviso, JSON.stringify({ titulo: aviso.titulo, detalhe: aviso.detalhe, link: aviso.link }));
  const r = await fetch(aviso.endpoint, {
    method: 'POST',
    headers: {
      TTL: '3600',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: await vapidHeader(aviso.endpoint, env)
    },
    body: corpo
  });
  if (r.status === 404 || r.status === 410) {
    await sql(env, 'select public.avisos_remover_assinatura($1)', [aviso.endpoint]);
    return 'removida';
  }
  if (!r.ok) throw new Error(`Push ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return 'ok';
}

async function rodar(env) {
  const avisos = await sql(env, 'select * from public.avisos_pendentes()');
  const res = { avisos: avisos.length, ok: 0, removidas: 0, erros: [] };
  for (const a of avisos) {
    try {
      const s = await enviar(a, env);
      if (s === 'ok') res.ok++; else res.removidas++;
    } catch (e) {
      res.erros.push(e.message);
    }
  }
  console.log('avisos', JSON.stringify(res));
  return res;
}

export default {
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(rodar(env));
  },
  // Só para checar se está vivo; não dispara nada
  async fetch() {
    return new Response('Arca avisos: ok');
  }
};

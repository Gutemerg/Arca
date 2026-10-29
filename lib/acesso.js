// Confere se quem chamou a função está logado na Arca e liberado na lista de autorizados.
import { createRemoteJWKSet, jwtVerify } from 'jose';

let JWKS;

function verdadeiro(v) {
  if (v === true || v === 'true' || v === 't') return true;
  if (Array.isArray(v)) return v.length > 0 && verdadeiro(v[0]);
  if (v && typeof v === 'object') return verdadeiro(v.arca_autorizado);
  return false;
}

export function dataApiUrl(env) {
  return env.NEON_DATA_API_URL || env.VITE_NEON_DATA_API_URL;
}

// Devolve { token } se estiver tudo certo, ou { status, body } com o erro.
export async function conferirAcesso(authorization, env) {
  JWKS ??= createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));
  const token = String(authorization || '').replace(/^Bearer /, '');
  try {
    await jwtVerify(token, JWKS);
  } catch {
    return { erro: { status: 401, body: { erro: 'Sessão inválida. Entre de novo.' } } };
  }
  // Tenta duas vezes: o banco gratuito "dorme" e a primeira chamada pode falhar ao acordar
  let ok = false;
  for (let tentativa = 0; tentativa < 2 && !ok; tentativa++) {
    if (tentativa) await new Promise((res) => setTimeout(res, 1500));
    const r = await fetch(`${dataApiUrl(env)}/rpc/arca_autorizado`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: '{}'
    }).catch(() => null);
    ok = r && r.ok ? verdadeiro(await r.json().catch(() => null)) : false;
    if (!ok) console.error('arca_autorizado', r?.status, r && !r.ok ? (await r.text().catch(() => '')).slice(0, 200) : '');
  }
  if (!ok) return { erro: { status: 403, body: { erro: 'Seu acesso à Arca ainda não foi liberado.' } } };
  return { token };
}

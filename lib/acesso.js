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
  const r = await fetch(`${dataApiUrl(env)}/rpc/arca_autorizado`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{}'
  }).catch(() => null);
  const ok = r && r.ok ? verdadeiro(await r.json().catch(() => null)) : false;
  if (!ok) return { erro: { status: 403, body: { erro: 'Seu acesso à Arca ainda não foi liberado.' } } };
  return { token };
}

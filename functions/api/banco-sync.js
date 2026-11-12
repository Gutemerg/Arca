// Cloudflare Pages Function — puxa os lançamentos da conta corrente (Pluggy) para a Arca.
import { comPadroes } from '../../lib/config.js';
import { sincronizarBanco } from '../../lib/banco.js';

export async function onRequestPost({ request, env: envBruto }) {
  const env = comPadroes(envBruto);
  try {
    const { status, body } = await sincronizarBanco({ authorization: request.headers.get('authorization'), env });
    return Response.json(body, { status });
  } catch (e) {
    console.error(e);
    return Response.json({ erro: 'Erro na função: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

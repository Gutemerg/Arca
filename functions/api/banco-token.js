// Cloudflare Pages Function — gera o token para abrir o Pluggy Connect dentro da Arca.
import { comPadroes } from '../../lib/config.js';
import { tokenConexao } from '../../lib/banco.js';

export async function onRequestPost({ request, env: envBruto }) {
  const env = comPadroes(envBruto);
  try {
    const corpo = await request.json().catch(() => ({}));
    const { status, body } = await tokenConexao({
      authorization: request.headers.get('authorization'), env, itemId: corpo.itemId, origem: new URL(request.url).origin
    });
    return Response.json(body, { status });
  } catch (e) {
    console.error(e);
    return Response.json({ erro: 'Erro na função: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

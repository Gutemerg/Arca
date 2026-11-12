// Cloudflare Pages Function — interpreta uma frase livre e devolve o registro estruturado.
import { capturar } from '../../lib/captura.js';

export async function onRequestPost({ request, env }) {
  try {
    const corpo = await request.json().catch(() => ({}));
    const { status, body } = await capturar({ authorization: request.headers.get('authorization'), corpo, env });
    return Response.json(body, { status });
  } catch (e) {
    console.error(e);
    return Response.json({ erro: 'Erro na função: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

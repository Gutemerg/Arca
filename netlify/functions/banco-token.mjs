// Netlify Function — gera o token para abrir o Pluggy Connect dentro da Arca.
import { tokenConexao } from '../../lib/banco.js';

const env = new Proxy({}, { get: (_, k) => Netlify.env.get(String(k)) });

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ erro: 'Use POST' }, { status: 405 });
  const corpo = await req.json().catch(() => ({}));
  const { status, body } = await tokenConexao({ authorization: req.headers.get('authorization'), env, itemId: corpo.itemId });
  return Response.json(body, { status });
};

export const config = { path: '/api/banco-token' };

// Netlify Function — puxa os lançamentos da conta corrente (Pluggy) para a Arca.
import { sincronizarBanco } from '../../lib/banco.js';

const env = new Proxy({}, { get: (_, k) => Netlify.env.get(String(k)) });

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ erro: 'Use POST' }, { status: 405 });
  const { status, body } = await sincronizarBanco({ authorization: req.headers.get('authorization'), env });
  return Response.json(body, { status });
};

export const config = { path: '/api/banco-sync' };

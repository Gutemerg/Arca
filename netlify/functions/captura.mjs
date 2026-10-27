// Netlify Function — interpreta uma frase livre e devolve o registro estruturado.
import { capturar } from '../../lib/captura.js';

const env = new Proxy({}, { get: (_, k) => Netlify.env.get(String(k)) });

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ erro: 'Use POST' }, { status: 405 });
  const corpo = await req.json().catch(() => ({}));
  const { status, body } = await capturar({ authorization: req.headers.get('authorization'), corpo, env });
  return Response.json(body, { status });
};

export const config = { path: '/api/captura' };

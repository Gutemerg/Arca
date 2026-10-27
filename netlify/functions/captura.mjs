// Netlify Function — interpreta uma frase livre e devolve o registro estruturado.
import { capturar } from '../../lib/captura.js';

const env = {
  get NEON_AUTH_JWKS_URL() { return Netlify.env.get('NEON_AUTH_JWKS_URL'); },
  get ANTHROPIC_API_KEY() { return Netlify.env.get('ANTHROPIC_API_KEY'); },
  get ARCA_MODELO() { return Netlify.env.get('ARCA_MODELO'); }
};

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ erro: 'Use POST' }, { status: 405 });
  const corpo = await req.json().catch(() => ({}));
  const { status, body } = await capturar({ authorization: req.headers.get('authorization'), corpo, env });
  return Response.json(body, { status });
};

export const config = { path: '/api/captura' };

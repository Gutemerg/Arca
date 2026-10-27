// Vercel Function — mesma lógica da Netlify (lib/captura.js).
import { capturar } from '../lib/captura.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const { status, body } = await capturar({ authorization: req.headers.authorization, corpo: req.body, env: process.env });
  return res.status(status).json(body);
}

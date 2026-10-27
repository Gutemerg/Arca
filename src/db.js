import { createClient } from '@neondatabase/neon-js';

export const db = createClient({
  auth: { url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL }
});

export async function sessaoAtual() {
  const { data } = await db.auth.getSession();
  return data?.session ? data : null;
}

// JWT do usuário (o mesmo que o SDK envia à Data API), para chamar /api/*
export async function tokenAtual() {
  const { data } = await db.auth.getSession();
  return data?.session?.token ?? null;
}

// A conta está na lista de autorizados da Arca? (regra do banco: public.arca_autorizado)
export async function acessoLiberado() {
  const token = await tokenAtual();
  if (!token) return false;
  const r = await fetch(`${import.meta.env.VITE_NEON_DATA_API_URL}/rpc/arca_autorizado`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{}'
  });
  if (!r.ok) throw new Error('Não consegui verificar seu acesso');
  return (await r.json()) === true;
}

// Atalho: lança erro se a consulta falhar
export async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message || 'Erro ao falar com o banco');
  return data;
}

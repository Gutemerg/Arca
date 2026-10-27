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
// Aceita os formatos que a Data API pode devolver: true, "true", [{arca_autorizado:true}] ou {arca_autorizado:true}
function verdadeiro(v) {
  if (v === true || v === 'true' || v === 't') return true;
  if (Array.isArray(v)) return v.length > 0 && verdadeiro(v[0]);
  if (v && typeof v === 'object') return verdadeiro(v.arca_autorizado);
  return false;
}

export async function acessoLiberado() {
  const { data, error } = await db.rpc('arca_autorizado');
  if (error) {
    console.error('arca_autorizado', error);
    throw new Error(error.message || 'Não consegui verificar seu acesso');
  }
  return verdadeiro(data);
}

// Atalho: lança erro se a consulta falhar
export async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message || 'Erro ao falar com o banco');
  return data;
}

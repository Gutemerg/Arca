// Sincroniza a conta corrente (Open Finance via Pluggy / Meu Pluggy) com os lançamentos da Arca.
// Roda com o JWT do usuário: tudo é gravado pela Data API, então o RLS do banco continua valendo.
import { conferirAcesso, dataApiUrl } from './acesso.js';

const PLUGGY = 'https://api.pluggy.ai';
const DIAS_PRIMEIRA_SYNC = 90;
const DIAS_SOBREPOSICAO = 7; // relê alguns dias para pegar lançamentos que o banco publica com atraso

// Categoria da Pluggy (inglês) → categoria da Arca. Confere primeiro a subcategoria, depois a principal.
const MAPA = [
  ['Food delivery', 'Delivery', 'saida'],
  ['Eating out', 'Restaurantes', 'saida'],
  ['Food and drinks', 'Restaurantes', 'saida'],
  ['Groceries', 'Mercado', 'saida'],
  ['Rent', 'Moradia', 'saida'],
  ['Real estate financing', 'Moradia', 'saida'],
  ['Utilities', 'Contas da casa', 'saida'],
  ['Telecommunications', 'Contas da casa', 'saida'],
  ['Houseware', 'Casa', 'saida'],
  ['Housing', 'Moradia', 'saida'],
  ['Pharmacy', 'Saúde', 'saida'],
  ['Healthcare', 'Saúde', 'saida'],
  ['Health insurance', 'Saúde', 'saida'],
  ['Insurance', 'Seguros', 'saida'],
  ['Wellness and fitness', 'Academia e bem-estar', 'saida'],
  ['Education', 'Educação', 'saida'],
  ['Gas stations', 'Combustível', 'saida'],
  ['Automotive', 'Veículo', 'saida'],
  ['Vehicle Financing', 'Veículo', 'saida'],
  ['Transportation', 'Transporte', 'saida'],
  ['Travel', 'Viagens', 'saida'],
  ['Digital services', 'Assinaturas', 'saida'],
  ['Tickets', 'Lazer', 'saida'],
  ['Leisure', 'Lazer', 'saida'],
  ['Gambling', 'Apostas', 'saida'],
  ['Shopping', 'Compras', 'saida'],
  ['Bank fees', 'Tarifas bancárias', 'saida'],
  ['Account fees', 'Tarifas bancárias', 'saida'],
  ['Wire transfer fees and ATM fees', 'Tarifas bancárias', 'saida'],
  ['Credit card fees', 'Tarifas bancárias', 'saida'],
  ['Late payment and overdraft costs', 'Empréstimos e juros', 'saida'],
  ['Interests charged', 'Empréstimos e juros', 'saida'],
  ['Taxes', 'Impostos', 'saida'],
  ['Urban land and building tax', 'Impostos', 'saida'],
  ['Loans and Financing', 'Empréstimos e juros', 'saida'],
  ['Donations', 'Doações', 'saida'],
  ['Legal obligations', 'Obrigações legais', 'saida'],
  ['Credit card payment', 'Fatura do cartão', 'saida'],
  ['Same person transfer', 'Entre minhas contas', null],
  ['Investments', 'Investimentos', null],
  ['Transfers', 'Transferências', null],
  ['Salary', 'Salário', 'entrada'],
  ['Retirement', 'Aposentadoria', 'entrada'],
  ['Income', 'Renda', 'entrada']
];

function nomeCategoria(cat, pai) {
  for (const [chave, nome] of MAPA) if (cat === chave) return nome;
  for (const [chave, nome] of MAPA) if (pai === chave) return nome;
  return 'Outros';
}

async function pluggy(caminho, apiKey, params = {}) {
  const url = new URL(caminho, PLUGGY);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
  if (!r.ok) throw new Error(`Pluggy ${caminho} respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function chavePluggy(env) {
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    throw new Error('Faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis da Netlify.');
  }
  const r = await fetch(`${PLUGGY}/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET })
  });
  if (!r.ok) throw new Error(`Não consegui entrar na Pluggy (${r.status}). Confira o Client ID e o Secret.`);
  return (await r.json()).apiKey;
}

async function todasTransacoes(apiKey, accountId, dateFrom) {
  const lista = [];
  let after = null;
  for (let pagina = 0; pagina < 40; pagina++) {
    const res = await pluggy('/v2/transactions', apiKey, { accountId, dateFrom, after });
    lista.push(...res.results);
    if (!res.next) break;
    after = new URL(res.next, PLUGGY).searchParams.get('after');
    if (!after) break;
  }
  return lista;
}

function dataApi(env, token) {
  const base = dataApiUrl(env);
  return async (caminho, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${base}/${caminho}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(prefer ? { prefer } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error(`Banco de dados respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json().catch(() => null);
  };
}

const isoDia = (d) => new Date(d).toISOString().slice(0, 10);

export async function sincronizarBanco({ authorization, env }) {
  const acesso = await conferirAcesso(authorization, env);
  if (acesso.erro) return acesso.erro;
  const db = dataApi(env, acesso.token);

  const conexoes = await db('banco_conexoes?select=id,item_id,apelido,ultima_sync');
  if (!conexoes?.length) return { status: 400, body: { erro: 'Nenhuma conta bancária conectada ainda.' } };

  let apiKey;
  try {
    apiKey = await chavePluggy(env);
  } catch (e) {
    return { status: 502, body: { erro: e.message } };
  }

  // Categorias da Pluggy (id → descrição e categoria-mãe) e categorias já criadas na Arca
  const catsPluggy = new Map();
  try {
    const res = await pluggy('/categories', apiKey);
    for (const c of res.results || []) catsPluggy.set(c.id, c);
  } catch { /* segue só com a descrição que vem na transação */ }

  const catsArca = new Map();
  for (const c of (await db('categorias?select=id,nome,tipo')) || []) catsArca.set(`${c.tipo}|${c.nome.toLowerCase()}`, c.id);
  async function categoriaId(nome, tipo) {
    const chave = `${tipo}|${nome.toLowerCase()}`;
    if (catsArca.has(chave)) return catsArca.get(chave);
    const [nova] = await db('categorias?on_conflict=user_id,nome,tipo', {
      method: 'POST', body: [{ nome, tipo }], prefer: 'resolution=merge-duplicates,return=representation'
    });
    catsArca.set(chave, nova.id);
    return nova.id;
  }

  const resumo = { novos: 0, lidos: 0, contas: 0, erros: [] };

  for (const cx of conexoes) {
    try {
      const desde = cx.ultima_sync
        ? isoDia(new Date(cx.ultima_sync).getTime() - DIAS_SOBREPOSICAO * 86400000)
        : isoDia(Date.now() - DIAS_PRIMEIRA_SYNC * 86400000);

      const contas = (await pluggy('/accounts', apiKey, { itemId: cx.item_id, type: 'BANK' })).results || [];
      const correntes = contas.filter((a) => a.subtype === 'CHECKING_ACCOUNT');
      resumo.contas += correntes.length;

      for (const conta of correntes) {
        const nomeConta = [conta.marketingName || conta.name, conta.number ? `•••${String(conta.number).slice(-4)}` : '']
          .filter(Boolean).join(' ');
        const trans = await todasTransacoes(apiKey, conta.id, desde);
        resumo.lidos += trans.length;

        const linhas = [];
        for (const t of trans) {
          if (t.status === 'PENDING' || !t.amount) continue;
          const tipo = t.type === 'CREDIT' ? 'entrada' : 'saida';
          const meta = t.categoryId ? catsPluggy.get(t.categoryId) : null;
          const nome = nomeCategoria(meta?.description || t.category, meta?.parentDescription);
          linhas.push({
            tipo,
            valor: Math.abs(Number(t.amount)).toFixed(2),
            descricao: (t.description || t.descriptionRaw || 'Lançamento bancário').slice(0, 200),
            categoria_id: await categoriaId(nome, tipo),
            data: isoDia(t.date),
            origem: 'banco',
            sala: 'financas',
            externo_id: `pluggy:${t.id}`,
            conta: nomeConta
          });
        }

        for (let i = 0; i < linhas.length; i += 200) {
          const inseridos = await db('lancamentos?on_conflict=user_id,externo_id&select=id', {
            method: 'POST', body: linhas.slice(i, i + 200), prefer: 'resolution=ignore-duplicates,return=representation'
          });
          resumo.novos += inseridos?.length || 0;
        }
      }

      await db(`banco_conexoes?id=eq.${cx.id}`, {
        method: 'PATCH', body: { ultima_sync: new Date().toISOString(), ultimo_erro: null }, prefer: 'return=minimal'
      });
    } catch (e) {
      console.error('sync', cx.item_id, e);
      resumo.erros.push(e.message);
      await db(`banco_conexoes?id=eq.${cx.id}`, {
        method: 'PATCH', body: { ultimo_erro: e.message.slice(0, 300) }, prefer: 'return=minimal'
      }).catch(() => {});
    }
  }

  return { status: resumo.erros.length && !resumo.novos && !resumo.lidos ? 502 : 200, body: resumo };
}

// Lógica compartilhada da captura: valida o JWT do usuário e pede à IA para
// estruturar a frase. Usada pela função da Netlify (e pela da Vercel, se voltar).
// Não grava nada: quem grava é o app, com o JWT do usuário (respeitando o RLS).
import { createRemoteJWKSet, jwtVerify } from 'jose';

let JWKS;

const ACOES = ['lancamento', 'conta_pagar', 'tarefa', 'consulta', 'documento', 'veiculo_evento', 'compra', 'ideia', 'pessoa', 'diario', 'saude', 'nao_entendi'];

const FERRAMENTA = {
  name: 'registrar',
  description: 'Registra o que o usuário disse na sala certa da Arca.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['acao', 'resumo', 'dados'],
    properties: {
      acao: { type: 'string', enum: ACOES },
      resumo: { type: 'string', description: 'Frase curta em português confirmando o que foi registrado, ex.: "Conta de luz de R$ 80,00 marcada como paga."' },
      dados: {
        type: 'object',
        description: 'Campos da ação. Datas em AAAA-MM-DD, horas em HH:MM, valores numéricos sem R$.',
        properties: {
          // lancamento
          tipo: { type: 'string', description: 'lancamento: entrada|saida. veiculo_evento: abastecimento|manutencao|revisao|seguro|ipva|licenciamento|multa|outro. consulta: consulta|exame|vacina. saude: sono|agua|peso|passos|treino|pressao|outro' },
          valor: { type: 'number' },
          descricao: { type: 'string' },
          categoria: { type: 'string', description: 'Categoria de gasto/entrada em português, ex.: Moradia, Mercado, Transporte, Delivery, Lazer, Saúde, Contas da casa, Salário' },
          data: { type: 'string' },
          // conta_pagar / documento / pessoa
          nome: { type: 'string' },
          vencimento: { type: 'string' },
          recorrencia: { type: 'string', enum: ['unica', 'mensal', 'anual'] },
          pasta: { type: 'string', description: 'documento: identidade|veiculo|casa|saude|contratos|garantias|outros' },
          validade: { type: 'string' },
          relacao: { type: 'string' },
          aniversario: { type: 'string' },
          // tarefa / consulta / ideia
          titulo: { type: 'string' },
          hora: { type: 'string' },
          local: { type: 'string' },
          etiquetas: { type: 'array', items: { type: 'string' } },
          // veiculo
          km: { type: 'number' },
          litros: { type: 'number' },
          // compra
          itens: { type: 'array', items: { type: 'string' } },
          // diario / saude
          humor: { type: 'integer', minimum: 1, maximum: 5 },
          texto: { type: 'string' },
          unidade: { type: 'string' }
        }
      }
    }
  }
};

function sistema() {
  const agora = new Date();
  const fmt = (o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(agora);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return `Você é a Arca, assistente que organiza a vida pessoal do usuário (Brasil, português).
Hoje é ${fmt({ weekday: 'long' })}, ${iso}, ${fmt({ hour: '2-digit', minute: '2-digit' })} (horário de Brasília).
Converta a frase do usuário em UM registro usando a ferramenta "registrar".

Regras:
- "paguei/gastei/comprei X" → lancamento tipo saida (se for conta da casa como luz, água, internet, aluguel, use categoria "Contas da casa").
- "recebi/caiu o salário" → lancamento tipo entrada.
- "a conta de X vence dia N" ou "tenho que pagar X dia N" → conta_pagar (vencimento na próxima ocorrência desse dia).
- Compromissos médicos, dentista, exames → consulta (data e hora juntas em "data" + "hora"; sem data definida use status pendente deixando data vazia).
- Algo a fazer / lembrar → tarefa.
- Abasteci, troquei óleo, revisão, seguro, IPVA, quilometragem do carro → veiculo_evento.
- "acabou X", "comprar X" (mercado) → compra com a lista de itens.
- "ideia:" ou algo a explorar no futuro → ideia.
- Aniversário ou dados de alguém → pessoa.
- Como foi o dia, sentimentos → diario (humor 1 a 5).
- Água, sono, peso, treino, passos → saude.
- Documento com validade (CNH, seguro, garantia, passaporte) → documento.
- Converta datas relativas ("amanhã", "sexta", "dia 12") para AAAA-MM-DD a partir de hoje; nunca invente datas que não foram ditas.
- Não invente valores. Se não der para entender, use nao_entendi e explique no resumo o que faltou.`;
}

export async function capturar({ authorization, corpo, env }) {
  JWKS ??= createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));

  // 1. Só usuários logados na Arca podem usar (protege a sua chave da IA)
  const token = String(authorization || '').replace(/^Bearer /, '');
  try {
    await jwtVerify(token, JWKS);
  } catch {
    return { status: 401, body: { erro: 'Sessão inválida. Entre de novo.' } };
  }

  // 1b. E só quem está na lista de autorizados (mesma regra do banco)
  const dataApi = env.NEON_DATA_API_URL || env.VITE_NEON_DATA_API_URL;
  const aut = await fetch(`${dataApi}/rpc/arca_autorizado`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{}'
  }).then((r) => (r.ok ? r.json() : false)).catch(() => false);
  if (aut !== true) return { status: 403, body: { erro: 'Seu acesso à Arca ainda não foi liberado.' } };

  const texto = String(corpo?.texto || '').trim().slice(0, 1000);
  if (!texto) return { status: 400, body: { erro: 'Escreva alguma coisa.' } };

  // 2. Pede para a IA estruturar
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.ARCA_MODELO || 'claude-haiku-5-5',
      max_tokens: 800,
      system: sistema(),
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: 'registrar' },
      messages: [{ role: 'user', content: texto }]
    })
  });

  if (!r.ok) {
    console.error('Anthropic', r.status, await r.text());
    return { status: 502, body: { erro: 'A IA não respondeu agora. Tente de novo.' } };
  }
  const out = await r.json();
  const uso = out.content?.find((c) => c.type === 'tool_use');
  if (!uso) return { status: 502, body: { erro: 'Não entendi. Tente com outras palavras.' } };

  return { status: 200, body: uso.input };
}

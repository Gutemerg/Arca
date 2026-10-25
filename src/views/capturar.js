import { db, q, tokenAtual } from '../db.js';
import { esc, reais, dataCurta, hojeISO, aviso } from '../util.js';

const EXEMPLOS = [
  'paguei 80 de luz',
  'dentista dia 12 às 15h',
  'abasteci 200 reais, 38 litros, 48.200 km',
  'acabou café e detergente',
  'ideia: app de receitas com o que tem na geladeira',
  'a internet vence todo dia 30, 119,90'
];

const NOMES_SALA = {
  lancamento: 'Finanças', conta_pagar: 'Finanças › Contas', tarefa: 'Tarefas', consulta: 'Saúde',
  documento: 'Documentos', veiculo_evento: 'Veículo', compra: 'Casa › Mercado', ideia: 'Ideias',
  pessoa: 'Pessoas', diario: 'Diário', saude: 'Saúde'
};

export default function capturar(tela, { params }) {
  const compartilhado = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join('\n');

  tela.innerHTML = `
    <header>
      <h1>Capturar</h1>
      <p class="sub">Fale ou escreva do seu jeito. A Arca entende e arquiva no lugar certo.</p>
    </header>
    <div id="conversa" style="display:flex;flex-direction:column;gap:14px"></div>
    <section aria-labelledby="h-ex" id="exemplos" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="h-ex" class="rotulo">Experimente</h2>
      <div class="chips">${EXEMPLOS.map((e) => `<button type="button" class="chip" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    </section>
    <form class="captura-barra" id="form-cap">
      <label for="cap" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Mensagem para a Arca</label>
      <textarea id="cap" rows="1" placeholder="Digite aqui…" enterkeyhint="send">${esc(compartilhado)}</textarea>
      <button type="button" class="btn-icone" id="voz" aria-label="Falar" style="background:var(--verde-fundo);color:var(--verde);border:0;width:52px;height:52px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
      </button>
      <button class="btn primario" style="min-height:52px" aria-label="Enviar">Enviar</button>
    </form>`;

  const caixa = tela.querySelector('#cap');
  const conversa = tela.querySelector('#conversa');
  const form = tela.querySelector('#form-cap');

  tela.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { caixa.value = b.dataset.ex; form.requestSubmit(); }));
  caixa.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  // Voz: reconhecimento do próprio Chrome (pt-BR)
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voz = tela.querySelector('#voz');
  if (!Rec) voz.hidden = true;
  else voz.addEventListener('click', () => {
    const rec = new Rec();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    voz.style.background = 'var(--verde)'; voz.style.color = 'var(--fundo)';
    rec.onresult = (e) => { caixa.value = e.results[0][0].transcript; form.requestSubmit(); };
    rec.onend = () => { voz.style.background = 'var(--verde-fundo)'; voz.style.color = 'var(--verde)'; };
    rec.onerror = () => aviso('Não consegui ouvir. Tente de novo.');
    rec.start();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = caixa.value.trim();
    if (!texto) return;
    caixa.value = '';
    tela.querySelector('#exemplos').hidden = true;

    const bolha = document.createElement('p');
    bolha.className = 'bolha'; bolha.textContent = texto;
    const card = document.createElement('section');
    card.className = 'card resultado'; card.innerHTML = '<p class="mini" style="margin:0">Entendendo…</p>';
    conversa.append(bolha, card);
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
      const r = await interpretar(texto);
      if (r.acao === 'nao_entendi') {
        card.innerHTML = `<p style="margin:0;font-size:14px;line-height:1.5">${esc(r.resumo)}</p>`;
        return;
      }
      const feito = await aplicar(r);
      await db.from('capturas').insert({ texto, resultado: r, tabela_destino: feito.tabela, registro_id: feito.ids[0] ?? null });
      card.innerHTML = cartaoResultado(r);
      card.querySelector('[data-desfazer]').addEventListener('click', async () => {
        await desfazer(feito);
        card.innerHTML = '<p class="mini" style="margin:0">Desfeito.</p>';
      });
    } catch (err) {
      // Sem IA (ou sem internet): guarda o texto para revisar depois
      await db.from('capturas').insert({ texto }).then(() => {}, () => {});
      card.innerHTML = `<p style="margin:0;font-size:14px;line-height:1.5">Guardei sua anotação, mas não consegui organizar agora (${esc(err.message)}). Ela fica salva para revisar depois.</p>`;
    }
  });

  if (compartilhado) caixa.focus();
}

async function interpretar(texto) {
  const token = await tokenAtual();
  const r = await fetch('/api/captura', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ texto })
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || 'IA indisponível');
  return corpo;
}

function cartaoResultado(r) {
  const d = r.dados || {};
  const campos = [
    ['Valor', d.valor != null ? reais(d.valor) : null],
    ['Data', d.data ? dataCurta(d.data) : null],
    ['Vencimento', d.vencimento ? dataCurta(d.vencimento) : null],
    ['Validade', d.validade ? dataCurta(d.validade) : null],
    ['Horário', d.hora || null],
    ['Categoria', d.categoria || null],
    ['Quilometragem', d.km ? Number(d.km).toLocaleString('pt-BR') + ' km' : null],
    ['Litros', d.litros || null],
    ['Itens', d.itens?.length ? d.itens.join(', ') : null],
    ['Etiquetas', d.etiquetas?.length ? d.etiquetas.join(', ') : null]
  ].filter(([, v]) => v != null);
  return `
    <p class="ok" style="margin:0 0 6px;font-size:12px">Arquivado em ${esc(NOMES_SALA[r.acao] || r.acao)}</p>
    <p style="margin:0 0 10px;font-size:15px;font-weight:700;line-height:1.4">${esc(r.resumo)}</p>
    ${campos.length ? `<dl>${campos.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <button type="button" class="btn pequeno" data-desfazer style="margin-top:12px">Desfazer</button>`;
}

// ---- Grava no banco conforme a ação ----
async function aplicar({ acao, dados: d = {} }) {
  const hj = hojeISO();
  const ins = async (tabela, linhas) => {
    const rows = await q(db.from(tabela).insert(linhas).select('id'));
    return { tabela, ids: rows.map((r) => r.id) };
  };

  switch (acao) {
    case 'lancamento': {
      const tipo = d.tipo === 'entrada' ? 'entrada' : 'saida';
      const categoria_id = d.categoria ? await categoria(d.categoria, tipo) : null;
      const feito = await ins('lancamentos', { tipo, valor: d.valor ?? 0, descricao: d.descricao || d.categoria || 'Lançamento', categoria_id, data: d.data || hj, origem: 'captura' });
      // Se havia uma conta em aberto com esse nome, marca como paga
      if (tipo === 'saida' && d.descricao) {
        const termo = d.descricao.split(' ').find((p) => p.length > 3) || d.descricao;
        const [c] = await q(db.from('contas_pagar').select('id,nome,valor,vencimento,recorrencia,debito_automatico').is('pago_em', null).ilike('nome', `%${termo}%`).order('vencimento').limit(1));
        if (c) {
          await q(db.from('contas_pagar').update({ pago_em: d.data || hj, lancamento_id: feito.ids[0], valor: c.valor ?? d.valor }).eq('id', c.id));
          if (c.recorrencia !== 'unica') {
            const prox = new Date(c.vencimento + 'T12:00:00');
            if (c.recorrencia === 'mensal') prox.setMonth(prox.getMonth() + 1); else prox.setFullYear(prox.getFullYear() + 1);
            await q(db.from('contas_pagar').insert({ nome: c.nome, valor: c.valor, vencimento: prox.toISOString().slice(0, 10), recorrencia: c.recorrencia, debito_automatico: c.debito_automatico }));
          }
        }
      }
      return feito;
    }
    case 'conta_pagar':
      return ins('contas_pagar', { nome: d.nome || d.descricao || d.titulo, valor: d.valor ?? null, vencimento: d.vencimento || d.data || hj, recorrencia: d.recorrencia || 'mensal' });
    case 'tarefa':
      return ins('tarefas', { titulo: d.titulo || d.descricao, data: d.data || hj, hora: d.hora || null });
    case 'consulta': {
      const data_hora = d.data ? new Date(`${d.data}T${d.hora || '09:00'}:00-03:00`).toISOString() : null;
      return ins('consultas', { titulo: d.titulo || d.descricao, tipo: ['consulta', 'exame', 'vacina'].includes(d.tipo) ? d.tipo : 'consulta', data_hora, local: d.local || null, status: data_hora ? 'agendada' : 'pendente' });
    }
    case 'documento':
      return ins('documentos', { nome: d.nome || d.titulo, pasta: d.pasta || 'outros', validade: d.validade || null });
    case 'veiculo_evento': {
      let [v] = await q(db.from('veiculos').select('id,km_atual').limit(1));
      if (!v) [v] = await q(db.from('veiculos').insert({}).select('id,km_atual'));
      const tipos = ['abastecimento', 'manutencao', 'revisao', 'seguro', 'ipva', 'licenciamento', 'multa', 'outro'];
      const feito = await ins('veiculo_eventos', { veiculo_id: v.id, tipo: tipos.includes(d.tipo) ? d.tipo : 'outro', descricao: d.descricao || null, data: d.data || hj, km: d.km || null, valor: d.valor ?? null, litros: d.litros || null });
      if (d.km && (!v.km_atual || d.km > v.km_atual)) await q(db.from('veiculos').update({ km_atual: d.km }).eq('id', v.id));
      if (d.valor) {
        const cat = await categoria('Transporte', 'saida');
        const l = await ins('lancamentos', { tipo: 'saida', valor: d.valor, descricao: d.descricao || d.tipo, categoria_id: cat, data: d.data || hj, sala: 'veiculo', origem: 'captura' });
        feito.extra = l;
      }
      return feito;
    }
    case 'compra':
      return ins('compras', (d.itens?.length ? d.itens : [d.descricao || d.titulo]).map((item) => ({ item })));
    case 'ideia':
      return ins('ideias', { titulo: d.titulo || d.descricao, etiquetas: d.etiquetas || [] });
    case 'pessoa':
      return ins('pessoas', { nome: d.nome, relacao: d.relacao || null, aniversario: d.aniversario || null });
    case 'diario': {
      const rows = await q(db.from('diario').upsert({ data: d.data || hj, humor: d.humor || null, texto: d.texto || d.descricao || null }, { onConflict: 'user_id,data' }).select('id'));
      return { tabela: 'diario', ids: rows.map((r) => r.id) };
    }
    case 'saude':
      return ins('saude_registros', { tipo: d.tipo || 'outro', valor: d.valor ?? null, unidade: d.unidade || null, nota: d.descricao || null, data: d.data || hj });
    default:
      throw new Error('ação desconhecida');
  }
}

async function categoria(nome, tipo) {
  const achou = await q(db.from('categorias').select('id').eq('tipo', tipo).ilike('nome', nome).limit(1));
  if (achou[0]) return achou[0].id;
  const [nova] = await q(db.from('categorias').insert({ nome, tipo }).select('id'));
  return nova.id;
}

async function desfazer(feito) {
  if (feito.extra) await desfazer(feito.extra);
  if (feito.tabela === 'lancamentos') await db.from('contas_pagar').update({ pago_em: null, lancamento_id: null }).in('lancamento_id', feito.ids);
  await q(db.from(feito.tabela).delete().in('id', feito.ids));
}

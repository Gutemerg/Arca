// Sala Treino — no estilo de um app de musculação (Hevy/Strong), com a identidade da Arca.
// Telas: início (#/treino), editar (?editar=id), treinar (?treinar=sessão), evolução (?evolucao=aba)
// e evolução de um exercício (?exercicio=nome).
// Tudo é salvo na hora: séries feitas vão para o banco; o que está sendo digitado fica guardado
// no aparelho e volta se o app for fechado no meio do treino.
import { db, q } from '../db.js';
import { esc, aviso, dataCurta } from '../util.js';
import { GRUPOS, TIPOS, DIAS, ORDEM_SEMANA, DIAS_LONGOS, DIAS_TITULO, umRM, kg } from '../exercicios.js';
import { execucao, temExecucao, equipamento, foto } from '../execucoes.js';

// ---------- utilidades ----------
const ir = (hash) => { location.hash = hash; };
const num = (s) => Number(String(s ?? '').replace(',', '.')) || 0;
const fmt = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ATIVO = 'arca-treino-ativo';
const chaveRascunho = (id) => 'arca-treino-' + id;
const CHAVE_DESCANSO = 'arca-descanso';
const SEIS_HORAS = 6 * 3600000;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const P = {
  voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  menu: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
  alca: '<path d="M5 9h14M5 15h14"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pausa: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  relogio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2.5h6"/>',
  dir: '<path d="M9 6l6 6-6 6"/>',
  esq: '<path d="M15 6l-6 6 6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  haltere: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  fogo: '<path d="M12 21c-3.9 0-7-2.8-7-6.5 0-3.5 3-5.5 4-9 2 1.5 3 3.5 3 5 1-1 1.5-2 1.5-3.5 2.5 2 4.5 4.6 4.5 7.5 0 3.7-3 6.5-6 6.5z"/>',
  tendencia: '<path d="M4 17l6-6 4 4 6-7M14 8h6v6"/>',
  barras: '<path d="M5 20v-7M10 20V8M15 20v-4M20 20V5"/>',
  trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/>',
  troca: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  historico: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5M12 8v4l3 2"/>',
  grafico: '<path d="M4 19h16M6 15l4-4 3 3 5-6"/>',
  lixo: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  braco: '<path d="M4 18.5c1.6-3.4 4-5.2 7.2-5.4l-1.4-4.6c-.4-1.4.3-2.6 1.6-3l2.4-.8c.9-.3 1.6.4 1.4 1.3l-.5 1.6-2 .3.9 3.6c2.6-.9 5.2.4 5.9 3 .6 2.5-1 4.5-3.7 4.5H5.2c-.8 0-1.4-.3-1.2-.5z"/>',
  seta: '<path d="M5 19L19 5M10 5h9v9"/>'
};
const CHEIOS = new Set(['menu', 'play', 'braco']);
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" class="ic ${CHEIOS.has(n) ? 'cheio' : ''} ${cls}" aria-hidden="true">${P[n]}</svg>`;

const letraDe = (t, i) => (t.nome.match(/treino\s+([a-z0-9])\b/i)?.[1] || String.fromCharCode(65 + (i % 26))).toUpperCase();
const minutosEstimados = (exs) => {
  const seg = exs.reduce((t, e) => t + (e.series || 3) * (45 + (e.descanso_seg ?? 90)), 0);
  return Math.max(10, Math.round(seg / 60 / 5) * 5);
};
const diasTexto = (dias) => (dias?.length ? ORDEM_SEMANA.filter((d) => dias.includes(d)).map((d) => DIAS_TITULO[d]).join(', ') : 'Sem dia fixo');
const alvoReps = (a, b) => (a && b && a !== b ? `${a}–${b}` : (b || a || ''));
function inicioSemana(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const duracaoTxt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// Folha inferior genérica. Resolve com { ...campos, acao } (acao = value do botão que enviou) ou null.
function abrirFolha(html, aoAbrir) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'folha-fundo';
    fundo.innerHTML = `<div class="folha" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(fundo);
    const fechar = (v) => { fundo.remove(); resolve(v); };
    fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(null); });
    const form = fundo.querySelector('form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      fechar({ ...Object.fromEntries(new FormData(form)), acao: e.submitter?.value || '' });
    });
    aoAbrir?.(fundo, fechar);
  });
}

// Menu de opções (⋮)
function escolher(titulo, opcoes) {
  return abrirFolha(`
    <h2>${esc(titulo)}</h2>
    <div class="menu-opcoes">${opcoes.map((o) => `<button type="button" class="menu-op ${o.perigo ? 'perigo' : ''}" data-op="${o.v}">${ic(o.ic || 'dir')}<span>${esc(o.t)}</span></button>`).join('')}</div>
    <button type="button" class="btn" data-fechar>Cancelar</button>`,
  (fundo, fechar) => fundo.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => fechar(b.dataset.op))));
}

function verExecucao(nome) {
  abrirFolha(`<div class="cabeca" style="align-items:center"><h2>${esc(nome)}</h2><button type="button" class="ic-btn" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
    ${execucao(nome, 'grande') || '<p class="mini">Sem imagem para este exercício.</p>'}
    <p class="mini" style="margin:0">Início e fim do movimento. Desça controlando e suba com força.</p>`);
}

export default async function treino(tela, { params }) {
  if (params.get('treinar')) return modoTreinar(tela, params.get('treinar'));
  if (params.get('editar')) return editor(tela, params.get('editar'));
  if (params.get('exercicio')) return historicoExercicio(tela, params.get('exercicio'));
  if (params.has('evolucao')) return evolucao(tela, params.get('evolucao') || 'resumo');
  return inicio(tela);
}

// Começa um treino com um toque
async function iniciarTreino(t) {
  if (t.tipo !== 'musculacao') return registrarLivre(t);
  const [s] = await q(db.from('treino_sessoes').insert({ treino_id: t.id, nome: t.nome, tipo: t.tipo }).select('id,inicio'));
  gravar(ATIVO, { id: s.id, inicio: Date.now() });
  ir(`#/treino?treinar=${s.id}`);
}

// ======================================================================
// 1. Início
// ======================================================================
async function inicio(tela) {
  const desde = new Date(Date.now() - 40 * 86400000).toISOString();
  const [treinos, sessoes] = await Promise.all([
    q(db.from('treinos').select('id,nome,tipo,dias,ordem,criado_em,treino_exercicios(id,series,descanso_seg)').eq('ativo', true).order('ordem').order('criado_em')),
    q(db.from('treino_sessoes').select('id,treino_id,nome,tipo,inicio,fim,duracao_min,treino_series(count)').gte('inicio', desde).order('inicio', { ascending: false }).limit(80))
  ]);

  // Treinos esquecidos abertos há mais de 6 horas: fecha (com séries) ou descarta (sem séries)
  const agora = Date.now();
  for (const s of sessoes.filter((x) => !x.fim && agora - new Date(x.inicio) > SEIS_HORAS)) {
    if (s.treino_series?.[0]?.count) {
      s.fim = new Date(new Date(s.inicio).getTime() + 60 * 60000).toISOString();
      q(db.from('treino_sessoes').update({ fim: s.fim, duracao_min: 60 }).eq('id', s.id)).catch(() => {});
    } else {
      q(db.from('treino_sessoes').delete().eq('id', s.id)).catch(() => {});
      s.descartada = true;
    }
  }
  const validas = sessoes.filter((s) => !s.descartada);
  const emAndamento = validas.find((s) => !s.fim);
  if (!emAndamento && ler(ATIVO)) gravar(ATIVO, null);
  const feitas = validas.filter((s) => s.fim);

  // Semana (segunda a domingo)
  const seg = inicioSemana();
  const hoje = new Date();
  const semana = ORDEM_SEMANA.map((d, i) => {
    const dia = new Date(seg); dia.setDate(seg.getDate() + i);
    return { d, dia, feito: feitas.some((s) => mesmoDia(new Date(s.inicio), dia)), hoje: mesmoDia(dia, hoje), futuro: dia > hoje };
  });
  const feitosSemana = feitas.filter((s) => new Date(s.inicio) >= seg).length;
  const diasPlanejados = new Set(treinos.flatMap((t) => t.dias || []));
  const meta = diasPlanejados.size || 3;

  // Próximo treino
  let proximo = null, quando = '';
  if (treinos.length) {
    const fezHoje = (t) => feitas.some((s) => s.treino_id === t.id && mesmoDia(new Date(s.inicio), hoje));
    for (let off = 0; off < 7 && !proximo; off++) {
      const d = (hoje.getDay() + off) % 7;
      const t = treinos.find((x) => (x.dias || []).includes(d) && !(off === 0 && fezHoje(x)));
      if (t) { proximo = t; quando = off === 0 ? 'Treino de hoje' : off === 1 ? 'Amanhã' : DIAS_TITULO[d]; }
    }
    if (!proximo) {
      const ultimo = feitas.find((s) => s.treino_id && treinos.some((t) => t.id === s.treino_id));
      const i = ultimo ? treinos.findIndex((t) => t.id === ultimo.treino_id) : -1;
      proximo = treinos[(i + 1) % treinos.length];
      quando = 'Próximo treino';
    } else if (quando !== 'Treino de hoje') quando = `Próximo treino · ${quando}`;
  }
  const verTodos = treinos.length > 4;

  const pct = Math.min(100, Math.round((feitosSemana / meta) * 100));
  const raio = 9, circ = 2 * Math.PI * raio;

  tela.innerHTML = `
    <header class="cabeca" style="align-items:center">
      <h1>Treinos</h1>
      <span style="display:flex;gap:8px;align-items:center"><a class="ic-btn verde grande" href="#/treino?evolucao=resumo" aria-label="Evolução e histórico">${ic('barras')}</a><button type="button" class="btn pequeno suave" id="novo">${ic('mais')} Treino</button></span>
    </header>

    <section class="tr-hero" aria-label="Meta da semana">
      <div class="tr-hero-txt">
        <span class="tr-hero-sobre">Minha rotina</span>
        <span class="tr-hero-tit">Meus treinos</span>
        <span class="tr-hero-meta">Meta semanal: ${plural(meta, 'treino', 'treinos')}</span>
        <span class="tr-hero-barra"><span style="width:${pct}%"></span></span>
      </div>
      <span class="tr-hero-anel" aria-label="${feitosSemana} de ${meta} treinos feitos nesta semana">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="${raio}" class="trilho"/><circle cx="12" cy="12" r="${raio}" class="valor" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct / 100)}"/></svg>
        <b>${feitosSemana}/${meta}</b>
      </span>
    </section>

    <section class="card tr-semana" aria-labelledby="h-semana">
      <h2 id="h-semana">Sua semana</h2>
      <div class="tr-dias">
        ${semana.map((x) => `
          <span class="tr-dia ${x.feito ? 'feito' : ''} ${x.hoje ? 'hoje' : ''}" aria-label="${DIAS_TITULO[x.d]}: ${x.feito ? 'treinou' : x.hoje ? 'hoje' : x.futuro ? 'ainda não chegou' : 'não treinou'}">
            <span class="sigla">${DIAS[x.d]}</span>
            <span class="bola">${x.feito ? ic('check') : x.hoje ? ic('haltere') : ''}</span>
          </span>`).join('')}
      </div>
    </section>

    ${emAndamento ? `
    <section class="tr-proximo" aria-label="Treino em andamento">
      <span class="tr-prox-sobre">Em andamento</span>
      <span class="tr-prox-tit">${esc(emAndamento.nome)}</span>
      <span class="tr-prox-info">${ic('relogio')} começou há ${Math.max(1, Math.round((agora - new Date(emAndamento.inicio)) / 60000))} min · ${plural(emAndamento.treino_series?.[0]?.count || 0, 'série feita', 'séries feitas')}</span>
      <a class="tr-prox-btn" href="#/treino?treinar=${emAndamento.id}">${ic('play')} Continuar treino</a>
    </section>` : proximo ? `
    <section class="tr-proximo" aria-label="${esc(quando)}">
      <span class="tr-prox-sobre">${esc(quando)}</span>
      <span class="tr-prox-tit">${esc(proximo.nome)}</span>
      <span class="tr-prox-info">${proximo.tipo === 'musculacao'
        ? `${ic('lista')} ${plural(proximo.treino_exercicios.length, 'exercício', 'exercícios')} <span class="sep"></span> ${ic('relogio')} ${minutosEstimados(proximo.treino_exercicios)} min`
        : `${ic('relogio')} ${TIPOS[proximo.tipo]}`}</span>
      <button type="button" class="tr-prox-btn" data-iniciar="${proximo.id}">${ic('play')} Iniciar treino</button>
    </section>` : `
    <section class="card tr-vazio">
      <span class="tr-vazio-ic">${ic('haltere')}</span>
      <h2>Monte seu primeiro treino</h2>
      <p class="mini">Ex.: Treino A (peito e tríceps), Treino B (costas e bíceps), Treino C (pernas).</p>
      <button type="button" class="btn primario" id="novo2">Criar treino</button>
    </section>`}

    ${treinos.length ? `
    <section class="card tr-lista" aria-labelledby="h-meus">
      <div class="cabeca" style="align-items:center"><h2 id="h-meus">Meus treinos</h2>${verTodos ? '<button type="button" class="link-btn" id="todos">Ver todos</button>' : ''}</div>
      ${treinos.map((t, i) => `
        <div class="tr-item ${verTodos && i >= 4 ? 'extra' : ''}" ${verTodos && i >= 4 ? 'hidden' : ''}>
          <a class="tr-item-link" href="#/treino?editar=${t.id}">
            <span class="tr-letra">${esc(letraDe(t, i))}</span>
            <span class="col"><span class="t">${esc(t.nome)}</span><span class="mini">${diasTexto(t.dias)} · ${t.tipo === 'musculacao' ? plural(t.treino_exercicios.length, 'exercício', 'exercícios') : TIPOS[t.tipo]}</span></span>
            ${ic('dir', 'seta')}
          </a>
          <button type="button" class="ic-btn verde" data-iniciar="${t.id}" aria-label="Iniciar ${esc(t.nome)}">${ic('play')}</button>
        </div>`).join('')}
    </section>` : ''}

    <a class="card tr-atalho" href="#/treino?evolucao=resumo">
      <span class="tr-atalho-ic">${ic('barras')}</span>
      <span class="col"><span class="t">Evolução e histórico</span><span class="mini">Cargas, frequência e recordes</span></span>
      ${ic('dir', 'seta')}
    </a>
    <button type="button" class="btn" id="avulso">${ic('relogio')} Registrar corrida ou cardio</button>`;

  tela.querySelector('#novo').addEventListener('click', novoTreino);
  tela.querySelector('#novo2')?.addEventListener('click', novoTreino);
  tela.querySelector('#avulso').addEventListener('click', () => registrarLivre(null));
  tela.querySelector('#todos')?.addEventListener('click', (e) => {
    tela.querySelectorAll('.tr-item.extra').forEach((x) => { x.hidden = false; });
    e.target.remove();
  });
  tela.querySelectorAll('[data-iniciar]').forEach((b) => b.addEventListener('click', async () => {
    if (emAndamento) {
      const op = await escolher('Já tem um treino em andamento', [
        { v: 'continuar', t: `Continuar ${emAndamento.nome}`, ic: 'play' },
        { v: 'novo', t: 'Encerrar o atual e começar este', ic: 'troca' }
      ]);
      if (op === 'continuar') return ir(`#/treino?treinar=${emAndamento.id}`);
      if (op !== 'novo') return;
      await encerrarSessao(emAndamento.id, emAndamento.inicio);
    }
    b.disabled = true;
    try { await iniciarTreino(treinos.find((t) => t.id === b.dataset.iniciar)); }
    catch (e) { aviso(e.message); b.disabled = false; }
  }));
}

async function encerrarSessao(id, inicioIso) {
  const algumas = await q(db.from('treino_series').select('id').eq('sessao_id', id).limit(1));
  if (algumas.length) {
    const fim = new Date();
    await q(db.from('treino_sessoes').update({ fim: fim.toISOString(), duracao_min: Math.max(1, Math.round((fim - new Date(inicioIso)) / 60000)) }).eq('id', id));
  } else await q(db.from('treino_sessoes').delete().eq('id', id));
  gravar(chaveRascunho(id), null);
  gravar(ATIVO, null);
  gravar(CHAVE_DESCANSO, null);
}

async function novoTreino() {
  const v = await abrirFolha(`
    <h2>Novo treino</h2>
    <form class="form">
      <div class="campo"><label for="t-nome">Nome</label><input id="t-nome" name="nome" placeholder="Ex.: Treino A – Peito e Tríceps" required autocomplete="off"></div>
      <div class="campo"><label for="t-tipo">Tipo</label><select id="t-tipo" name="tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
      <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Criar</button></div>
    </form>`, (f) => f.querySelector('input').focus());
  if (!v) return;
  const [t] = await q(db.from('treinos').insert({ nome: v.nome.trim(), tipo: v.tipo }).select('id'));
  ir(`#/treino?editar=${t.id}`);
}

// Corrida, cardio, funcional: registro simples
async function registrarLivre(t) {
  const v = await abrirFolha(`
    <h2>${t ? esc(t.nome) : 'Registrar atividade'}</h2>
    <form class="form">
      ${t ? '' : `<div class="campo"><label for="l-nome">Atividade</label><input id="l-nome" name="nome" placeholder="Ex.: Corrida no parque" required></div>
      <div class="campo"><label for="l-tipo">Tipo</label><select id="l-tipo" name="tipo">${Object.entries(TIPOS).filter(([k]) => k !== 'musculacao').map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>`}
      <div class="grade-2">
        <div class="campo"><label for="l-min">Duração (min)</label><input id="l-min" name="duracao" inputmode="numeric" required></div>
        <div class="campo"><label for="l-km">Distância (km)</label><input id="l-km" name="km" inputmode="decimal" placeholder="opcional"></div>
      </div>
      <div class="campo"><label for="l-esf">Esforço (1 leve a 10 máximo)</label><input id="l-esf" name="esforco" type="number" min="1" max="10" placeholder="opcional"></div>
      <div class="campo"><label for="l-notas">Observações</label><input id="l-notas" name="notas"></div>
      <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
    </form>`);
  if (!v) return;
  const dur = Math.round(num(v.duracao));
  const fim = new Date();
  await q(db.from('treino_sessoes').insert({
    treino_id: t?.id || null, nome: t?.nome || v.nome, tipo: t?.tipo || v.tipo,
    inicio: new Date(fim - dur * 60000).toISOString(), fim: fim.toISOString(), duracao_min: dur,
    distancia_km: v.km ? num(v.km) : null, esforco: v.esforco ? Math.round(num(v.esforco)) : null, notas: v.notas || null
  }).select('id'));
  aviso('Atividade registrada');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ======================================================================
// 2. Editar treino
// ======================================================================
async function editor(tela, id) {
  const [[t], exs, custom] = await Promise.all([
    q(db.from('treinos').select('id,nome,tipo,dias,notas').eq('id', id)),
    q(db.from('treino_exercicios').select('id,nome,grupo,ordem,series,reps_min,reps_max,descanso_seg').eq('treino_id', id).order('ordem').order('criado_em')),
    q(db.from('exercicios_custom').select('nome,grupo').order('nome'))
  ]);
  if (!t) return ir('#/treino');
  const recarregar = () => editor(tela, id);
  const salvarNome = async (valor) => {
    const nome = valor.trim();
    if (!nome || nome === t.nome) return;
    t.nome = nome;
    await q(db.from('treinos').update({ nome }).eq('id', id)).catch((e) => aviso(e.message));
  };

  tela.innerHTML = `
    <header class="tr-cab">
      <a class="ic-btn" href="#/treino" aria-label="Voltar aos treinos">${ic('voltar')}</a>
      <h1>Editar treino</h1>
      <button type="button" class="ic-btn" id="mais-op" aria-label="Mais opções">${ic('menu')}</button>
    </header>

    <section class="card form tr-form">
      <div class="campo"><label for="e-nome">Nome do treino</label><input id="e-nome" value="${esc(t.nome)}" autocomplete="off"></div>
      <div class="campo"><span class="rot">Dias da semana</span>
        <div class="tr-chips-dias" role="group" aria-label="Dias da semana">${ORDEM_SEMANA.map((d) => `<button type="button" class="tr-chip-dia" data-dia="${d}" aria-pressed="${(t.dias || []).includes(d)}" aria-label="${DIAS_TITULO[d]}">${DIAS[d]}</button>`).join('')}</div>
      </div>
    </section>

    ${t.tipo === 'musculacao' ? `
    <section aria-labelledby="h-ex" style="display:flex;flex-direction:column;gap:10px">
      <div class="cabeca" style="align-items:center"><h2 id="h-ex">Exercícios (${exs.length})</h2>${exs.length > 1 ? `<span class="mini">${ic('alca', 'mini-ic')} arraste para ordenar</span>` : ''}</div>
      <div class="tr-exlista" id="exlista">
        ${exs.map((e, i) => `
          <div class="tr-ex" data-item="${e.id}">
            <button type="button" class="tr-alca" data-alca aria-label="Arrastar ${esc(e.nome)} para mudar a ordem">${ic('alca')}</button>
            ${foto(e.nome) ? `<button type="button" class="tr-thumb" data-exec="${esc(e.nome)}" aria-label="Ver execução de ${esc(e.nome)}"><img src="${foto(e.nome)}" alt="" loading="lazy"></button>` : `<span class="tr-thumb vazio">${ic('haltere')}</span>`}
            <span class="col"><span class="t">${i + 1}. ${esc(e.nome)}</span><span class="mini">${plural(e.series, 'série', 'séries')}${alvoReps(e.reps_min, e.reps_max) ? ' · ' + alvoReps(e.reps_min, e.reps_max) + ' reps' : ''} · ${e.descanso_seg}s</span></span>
            <button type="button" class="ic-btn" data-opcoes="${e.id}" aria-label="Ajustar ${esc(e.nome)}">${ic('menu')}</button>
          </div>`).join('') || '<p class="mini" style="margin:0">Nenhum exercício ainda. Toque em adicionar.</p>'}
      </div>
      <button type="button" class="btn tr-add" id="add-ex">${ic('mais')} Adicionar exercício</button>
    </section>` : `<p class="mini" style="margin:0;line-height:1.5">Treinos de ${TIPOS[t.tipo].toLowerCase()} são registrados com duração, distância e esforço ao tocar em iniciar.</p>`}

    <button type="button" class="btn primario tr-salvar" id="salvar">Salvar treino</button>
    <p class="mini" style="margin:0;text-align:center">As alterações são salvas automaticamente.</p>`;

  const nomeInp = tela.querySelector('#e-nome');
  let tNome;
  nomeInp.addEventListener('input', () => { clearTimeout(tNome); tNome = setTimeout(() => salvarNome(nomeInp.value), 700); });
  nomeInp.addEventListener('change', () => salvarNome(nomeInp.value));
  tela.querySelector('#salvar').addEventListener('click', async () => {
    await salvarNome(nomeInp.value);
    aviso('Treino salvo');
    ir('#/treino');
  });
  tela.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', async () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    const dias = [...tela.querySelectorAll('[data-dia][aria-pressed="true"]')].map((x) => Number(x.dataset.dia));
    await q(db.from('treinos').update({ dias }).eq('id', id)).catch((e) => aviso(e.message));
  }));
  tela.querySelector('#mais-op').addEventListener('click', async () => {
    const op = await escolher(t.nome, [
      { v: 'iniciar', t: 'Iniciar este treino agora', ic: 'play' },
      { v: 'tipo', t: `Tipo: ${TIPOS[t.tipo]}`, ic: 'troca' },
      { v: 'apagar', t: 'Apagar treino', ic: 'lixo', perigo: true }
    ]);
    if (op === 'iniciar') { await salvarNome(nomeInp.value); return iniciarTreino(t).catch((e) => aviso(e.message)); }
    if (op === 'tipo') {
      const v = await abrirFolha(`<h2>Tipo do treino</h2><form class="form"><div class="campo"><label for="tp">Tipo</label><select id="tp" name="tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}" ${k === t.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div></form>`);
      if (v) { await q(db.from('treinos').update({ tipo: v.tipo }).eq('id', id)); recarregar(); }
    }
    if (op === 'apagar') {
      const v = await abrirFolha(`<h2>Apagar "${esc(t.nome)}"?</h2><p class="mini" style="margin:0">O histórico dos treinos já feitos continua guardado.</p><form class="form"><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario perigo">Apagar</button></div></form>`);
      if (!v) return;
      await q(db.from('treinos').update({ ativo: false }).eq('id', id));
      aviso('Treino apagado');
      ir('#/treino');
    }
  });
  if (t.tipo !== 'musculacao') return;

  tela.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', () => verExecucao(b.dataset.exec)));
  tela.querySelectorAll('[data-opcoes]').forEach((b) => b.addEventListener('click', async () => {
    const e = exs.find((x) => x.id === b.dataset.opcoes);
    const v = await abrirFolha(`
      <div class="cabeca" style="align-items:center"><h2>${esc(e.nome)}</h2><button type="button" class="ic-btn" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
      <form class="form">
        <div class="grade-2">
          <div class="campo"><label for="o-s">Séries</label><input id="o-s" name="series" inputmode="numeric" value="${e.series}"></div>
          <div class="campo"><label for="o-d">Descanso (seg)</label><input id="o-d" name="descanso" inputmode="numeric" value="${e.descanso_seg}"></div>
          <div class="campo"><label for="o-r1">Reps mínimo</label><input id="o-r1" name="rmin" inputmode="numeric" value="${e.reps_min ?? ''}"></div>
          <div class="campo"><label for="o-r2">Reps máximo</label><input id="o-r2" name="rmax" inputmode="numeric" value="${e.reps_max ?? ''}"></div>
        </div>
        <button class="btn primario" value="salvar">Salvar</button>
        <div class="grade-2">
          <button class="btn" value="trocar" formnovalidate>${ic('troca')} Trocar</button>
          <button class="btn perigo-txt" value="remover" formnovalidate>${ic('lixo')} Remover</button>
        </div>
      </form>`);
    if (!v) return;
    if (v.acao === 'remover') { await q(db.from('treino_exercicios').delete().eq('id', e.id)); return recarregar(); }
    if (v.acao === 'trocar') {
      const [novo] = (await seletorExercicios(custom, exs.map((x) => x.nome), true)) || [];
      if (!novo) return;
      await q(db.from('treino_exercicios').update({ nome: novo.nome, grupo: novo.grupo }).eq('id', e.id));
      return recarregar();
    }
    const inteiro = (s, padrao) => (String(s).trim() === '' ? padrao : Math.max(0, Math.round(num(s))));
    await q(db.from('treino_exercicios').update({
      series: Math.max(1, inteiro(v.series, 3)), descanso_seg: inteiro(v.descanso, 90),
      reps_min: inteiro(v.rmin, null), reps_max: inteiro(v.rmax, null)
    }).eq('id', e.id)).catch((err) => aviso(err.message));
    recarregar();
  }));
  tela.querySelector('#add-ex').addEventListener('click', async () => {
    const escolhidos = await seletorExercicios(custom, exs.map((e) => e.nome));
    if (!escolhidos?.length) return;
    await q(db.from('treino_exercicios').insert(escolhidos.map((x, i) => ({
      treino_id: id, nome: x.nome, grupo: x.grupo, ordem: exs.length + i, series: 3, reps_min: 8, reps_max: 12, descanso_seg: 90
    }))).select('id'));
    recarregar();
  });
  arrastarParaOrdenar(tela.querySelector('#exlista'), async (ids) => {
    await Promise.all(ids.map((eid, i) => q(db.from('treino_exercicios').update({ ordem: i }).eq('id', eid))));
    recarregar();
  });
}

// Arrastar pela alça (≡) para reordenar — funciona com o dedo e com o mouse
function arrastarParaOrdenar(lista, aoSoltar) {
  if (!lista) return;
  lista.querySelectorAll('[data-alca]').forEach((alca) => {
    alca.addEventListener('pointerdown', (e) => {
      const item = alca.closest('[data-item]');
      const antes = [...lista.querySelectorAll('[data-item]')].map((x) => x.dataset.item).join();
      alca.setPointerCapture(e.pointerId);
      item.classList.add('arrastando');
      const mover = (ev) => {
        const outros = [...lista.querySelectorAll('[data-item]')].filter((x) => x !== item);
        for (const o of outros) {
          const r = o.getBoundingClientRect();
          if (ev.clientY > r.top && ev.clientY < r.bottom) {
            const depois = ev.clientY > r.top + r.height / 2;
            lista.insertBefore(item, depois ? o.nextSibling : o);
            break;
          }
        }
      };
      const soltar = () => {
        alca.removeEventListener('pointermove', mover);
        alca.removeEventListener('pointerup', soltar);
        alca.removeEventListener('pointercancel', soltar);
        item.classList.remove('arrastando');
        const ids = [...lista.querySelectorAll('[data-item]')].map((x) => x.dataset.item);
        if (ids.join() !== antes) aoSoltar(ids);
      };
      alca.addEventListener('pointermove', mover);
      alca.addEventListener('pointerup', soltar);
      alca.addEventListener('pointercancel', soltar);
    });
  });
}

// ======================================================================
// 3. Biblioteca de exercícios (tela cheia). unico = escolher só um (trocar exercício)
// ======================================================================
function seletorExercicios(custom, jaNoTreino = [], unico = false) {
  return new Promise((resolve) => {
    const grupos = { ...GRUPOS };
    if (custom.length) grupos['Meus exercícios'] = custom.map((c) => c.nome);
    const grupoDe = {};
    Object.entries(GRUPOS).forEach(([g, l]) => l.forEach((n) => { grupoDe[n] = g; }));
    custom.forEach((c) => { grupoDe[c.nome] = c.grupo; });
    const marcados = new Set();
    let grupoAtual = 'Todos';
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    const caixa = document.createElement('div');
    caixa.className = 'tr-biblio';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', 'Biblioteca de exercícios');
    caixa.innerHTML = `
      <header class="tr-biblio-cab">
        <h1>${unico ? 'Trocar exercício' : 'Exercícios'}</h1>
        <button type="button" class="ic-btn" data-x aria-label="Fechar">${ic('fechar')}</button>
      </header>
      <label class="tr-busca">${ic('busca')}<input type="search" placeholder="Buscar exercício…" aria-label="Buscar exercício" autocomplete="off"></label>
      <div class="tr-filtros" role="group" aria-label="Grupo muscular">${['Todos', ...Object.keys(grupos)].map((g, i) => `<button type="button" class="tr-filtro" data-grupo="${esc(g)}" aria-pressed="${i === 0}">${esc(g)}</button>`).join('')}</div>
      <div class="tr-grade" data-lista></div>
      ${unico ? '' : `<footer class="tr-biblio-rodape"><span data-conta>Nenhum exercício selecionado</span><button type="button" class="btn primario" data-ok disabled>Adicionar</button></footer>`}`;
    document.body.appendChild(caixa);
    document.body.classList.add('sem-rolagem');
    const lista = caixa.querySelector('[data-lista]');
    const busca = caixa.querySelector('input');
    const ok = caixa.querySelector('[data-ok]');
    const conta = caixa.querySelector('[data-conta]');

    const fechar = (v) => { caixa.remove(); document.body.classList.remove('sem-rolagem'); resolve(v); };
    const atualizarRodape = () => {
      if (unico) return;
      const n = marcados.size;
      conta.textContent = n ? `${plural(n, 'exercício selecionado', 'exercícios selecionados')}` : 'Nenhum exercício selecionado';
      ok.disabled = !n;
    };
    const desenhar = () => {
      const termo = norm(busca.value.trim());
      const vistos = new Set();
      const itens = Object.entries(grupos)
        .filter(([g]) => grupoAtual === 'Todos' || g === grupoAtual)
        .flatMap(([g, l]) => l.map((n) => ({ nome: n, grupo: g === 'Meus exercícios' ? grupoDe[n] : g })))
        .filter((x) => (!termo || norm(x.nome).includes(termo)) && !vistos.has(x.nome) && vistos.add(x.nome));
      lista.innerHTML = itens.slice(0, 150).map((x) => {
        const ja = jaNoTreino.includes(x.nome);
        const sel = marcados.has(x.nome);
        const eq = equipamento(x.nome);
        return `
        <div class="tr-cartao ${sel ? 'sel' : ''} ${ja ? 'ja' : ''}">
          ${foto(x.nome)
            ? `<button type="button" class="tr-cartao-img" data-ver="${esc(x.nome)}" aria-label="Ver execução de ${esc(x.nome)}"><img src="${foto(x.nome)}" alt="" loading="lazy" decoding="async"><span class="tr-ver">${ic('play')}</span></button>`
            : `<span class="tr-cartao-img vazio">${ic('haltere')}</span>`}
          <button type="button" class="tr-cartao-info" data-ex="${esc(x.nome)}" ${ja ? 'disabled' : ''} aria-pressed="${sel}" aria-label="${ja ? esc(x.nome) + ', já está no treino' : (sel ? 'Tirar ' : 'Escolher ') + esc(x.nome)}">
            <span class="col"><span class="t">${esc(x.nome)}</span><span class="mini">${ja ? 'Já está no treino' : esc(x.grupo) + (eq ? ' · ' + esc(eq) : '')}</span></span>
            <span class="tr-cartao-mais" aria-hidden="true">${ic(sel ? 'check' : 'mais')}</span>
          </button>
        </div>`;
      }).join('') + `
        <button type="button" class="tr-cartao-novo" data-novo>${ic('mais')}<span>Criar exercício${busca.value.trim() ? ` "${esc(busca.value.trim())}"` : ''}</span></button>`;
      lista.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => {
        const n = b.dataset.ex;
        if (unico) return fechar([{ nome: n, grupo: grupoDe[n] || 'Outros' }]);
        if (marcados.has(n)) marcados.delete(n); else marcados.add(n);
        const sel = marcados.has(n);
        b.setAttribute('aria-pressed', String(sel));
        b.closest('.tr-cartao').classList.toggle('sel', sel);
        b.querySelector('.tr-cartao-mais').innerHTML = ic(sel ? 'check' : 'mais');
        atualizarRodape();
      }));
      lista.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => verExecucao(b.dataset.ver)));
      lista.querySelector('[data-novo]').addEventListener('click', criar);
    };
    async function criar() {
      const v = await abrirFolha(`
        <h2>Criar exercício</h2>
        <form class="form">
          <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" name="nome" value="${esc(busca.value.trim())}" required autocomplete="off"></div>
          <div class="campo"><label for="c-gr">Grupo muscular</label><select id="c-gr" name="grupo">${[...Object.keys(GRUPOS), 'Outros'].map((g) => `<option ${g === grupoAtual ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Criar</button></div>
        </form>`, (f) => f.querySelector('input').focus());
      if (!v) return;
      const nome = v.nome.trim();
      try {
        await q(db.from('exercicios_custom').upsert({ nome, grupo: v.grupo }, { onConflict: 'user_id,nome', ignoreDuplicates: true }));
      } catch (e) { return aviso(e.message); }
      grupoDe[nome] = v.grupo;
      grupos['Meus exercícios'] = [...new Set([...(grupos['Meus exercícios'] || []), nome])];
      if (unico) return fechar([{ nome, grupo: v.grupo }]);
      marcados.add(nome);
      busca.value = '';
      desenhar(); atualizarRodape();
    }
    busca.addEventListener('input', desenhar);
    caixa.querySelectorAll('[data-grupo]').forEach((b) => b.addEventListener('click', () => {
      grupoAtual = b.dataset.grupo;
      caixa.querySelectorAll('[data-grupo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      desenhar();
    }));
    caixa.querySelector('[data-x]').addEventListener('click', () => fechar(null));
    ok?.addEventListener('click', () => fechar([...marcados].map((n) => ({ nome: n, grupo: grupoDe[n] || 'Outros' }))));
    desenhar();
  });
}

// ======================================================================
// 4. Treinar (um exercício por vez, sem a barra de navegação do app)
// ======================================================================
let descanso = ler(CHAVE_DESCANSO); // { fim, total, pausa (ms restantes quando pausado), exercicio }
let tique = null;

async function modoTreinar(tela, sessaoId) {
  const [sessao] = await q(db.from('treino_sessoes').select('id,treino_id,nome,inicio,fim').eq('id', sessaoId));
  if (!sessao || sessao.fim) {
    gravar(ATIVO, null);
    if (sessao?.fim) aviso('Esse treino já foi finalizado');
    return ir('#/treino');
  }
  gravar(ATIVO, { id: sessaoId, inicio: new Date(sessao.inicio).getTime() });
  const inicioMs = new Date(sessao.inicio).getTime();

  const [modelo, feitas, custom] = await Promise.all([
    sessao.treino_id
      ? q(db.from('treino_exercicios').select('nome,grupo,series,reps_min,reps_max,descanso_seg').eq('treino_id', sessao.treino_id).order('ordem').order('criado_em'))
      : Promise.resolve([]),
    q(db.from('treino_series').select('id,exercicio,serie_n,carga,reps').eq('sessao_id', sessaoId)),
    q(db.from('exercicios_custom').select('nome,grupo').order('nome'))
  ]);

  // Última vez e recorde de cada exercício (outras sessões)
  const ultimaDe = {}, recordeDe = {};
  async function carregarHistorico(nomes) {
    const faltam = nomes.filter((n) => !(n in ultimaDe));
    if (!faltam.length) return;
    faltam.forEach((n) => { ultimaDe[n] = null; recordeDe[n] = 0; });
    const ant = await q(db.from('treino_series').select('exercicio,serie_n,carga,reps,sessao_id,feito_em').in('exercicio', faltam).neq('sessao_id', sessaoId).order('feito_em', { ascending: false }).limit(1500));
    for (const s of ant) {
      recordeDe[s.exercicio] = Math.max(recordeDe[s.exercicio] || 0, Number(s.carga || 0));
      const u = ultimaDe[s.exercicio] || (ultimaDe[s.exercicio] = { sessao: s.sessao_id, data: s.feito_em, series: {} });
      if (u.sessao === s.sessao_id && !u.series[s.serie_n]) u.series[s.serie_n] = s;
    }
  }

  const rascunho = ler(chaveRascunho(sessaoId));
  const base = rascunho?.exs?.length ? rascunho.exs : modelo.map((m) => ({
    nome: m.nome, grupo: m.grupo, alvo: m.series, reps_min: m.reps_min, reps_max: m.reps_max, descanso: m.descanso_seg ?? 90, series: null
  }));
  // exercícios com séries salvas que não estão na lista (ex.: trocados) entram no fim
  for (const f of feitas) if (!base.some((b) => b.nome === f.exercicio)) base.push({ nome: f.exercicio, grupo: null, alvo: 1, descanso: 90, series: null });
  await carregarHistorico(base.map((b) => b.nome));

  const prefill = (x, n) => {
    const u = ultimaDe[x.nome];
    const ant = u ? (u.series[n] || u.series[Math.max(...Object.keys(u.series).map(Number))]) : null;
    return { n, carga: ant?.carga != null ? Number(ant.carga) : null, reps: ant?.reps ?? x.reps_max ?? x.reps_min ?? 10, id: null };
  };
  const estado = base.map((b) => {
    const x = { nome: b.nome, grupo: b.grupo, alvo: b.alvo || 3, reps_min: b.reps_min, reps_max: b.reps_max, descanso: b.descanso ?? 90 };
    const salvas = feitas.filter((f) => f.exercicio === x.nome);
    const qtd = Math.max(b.series?.length || x.alvo, ...salvas.map((f) => f.serie_n));
    x.series = Array.from({ length: qtd }, (_, i) => {
      const n = i + 1;
      const f = salvas.find((s) => s.serie_n === n);
      if (f) return { n, carga: f.carga != null ? Number(f.carga) : null, reps: f.reps, id: f.id };
      const r = b.series?.find((s) => s.n === n);
      return r ? { n, carga: r.carga, reps: r.reps, id: null } : prefill(x, n);
    });
    return x;
  });
  let idx = Math.min(rascunho?.idx || 0, Math.max(0, estado.length - 1));
  const recordesHoje = [];

  const salvarRascunho = () => gravar(chaveRascunho(sessaoId), {
    idx, exs: estado.map((x) => ({ nome: x.nome, grupo: x.grupo, alvo: x.alvo, reps_min: x.reps_min, reps_max: x.reps_max, descanso: x.descanso, series: x.series.map(({ n, carga, reps }) => ({ n, carga, reps })) }))
  });
  salvarRascunho();

  const totais = () => {
    const total = estado.reduce((t, x) => t + x.series.length, 0);
    const feitasN = estado.reduce((t, x) => t + x.series.filter((s) => s.id).length, 0);
    const volume = estado.reduce((t, x) => t + x.series.filter((s) => s.id).reduce((v, s) => v + Number(s.carga || 0) * Number(s.reps || 0), 0), 0);
    return { total, feitasN, volume };
  };
  const ultimaTexto = (nome) => {
    const u = ultimaDe[nome];
    if (!u) return null;
    const melhor = Object.values(u.series).reduce((m, s) => (!m || Number(s.carga || 0) > Number(m.carga || 0) || (Number(s.carga || 0) === Number(m.carga || 0) && s.reps > m.reps) ? s : m), null);
    return Number(melhor.carga) ? `${fmt(melhor.carga)} kg × ${melhor.reps} reps` : `${melhor.reps} reps`;
  };

  function desenhar() {
    const x = estado[idx];
    const { total, feitasN } = totais();
    const ultimo = idx === estado.length - 1;
    const prox = estado[idx + 1];
    const completo = x && x.series.length && x.series.every((s) => s.id);
    const det = x ? [x.grupo, equipamento(x.nome), plural(x.series.length, 'série', 'séries')].filter(Boolean).join(' · ') : '';
    const alvo = x ? alvoReps(x.reps_min, x.reps_max) : '';
    const ult = x ? ultimaTexto(x.nome) : null;

    tela.innerHTML = `
      <header class="tr-topo">
        <a class="ic-btn" href="#/treino" aria-label="Voltar aos treinos (o treino continua)">${ic('voltar')}</a>
        <div class="tr-topo-centro">
          <span class="tr-topo-nome">${esc(sessao.nome)} em andamento</span>
          <span class="tr-relogio" id="tr-relogio" role="timer" aria-label="Tempo de treino">${duracaoTxt(Date.now() - inicioMs)}</span>
        </div>
        <button type="button" class="link-btn" id="finalizar">Finalizar</button>
      </header>
      <span class="barra tr-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitasN}" aria-label="${feitasN} de ${total} séries feitas"><span style="width:${total ? (feitasN / total) * 100 : 0}%"></span></span>
      <button type="button" class="tr-contador" id="ver-lista">${estado.length ? `Exercício ${idx + 1} de ${estado.length}` : 'Sem exercícios'} ${ic('baixo')}</button>

      ${x ? `
      <section class="card tr-exercicio" aria-labelledby="h-exatual">
        <div class="tr-midia">
          ${execucao(x.nome, 'media') || `<span class="exec media vazio">${ic('haltere')}</span>`}
          ${temExecucao(x.nome) ? `<button type="button" class="tr-play" id="play" aria-label="Pausar animação">${ic('pausa')}</button>` : ''}
        </div>
        <div class="tr-ex-cab">
          <div class="col"><h2 id="h-exatual">${esc(x.nome)}</h2><span class="mini">${esc(det)}${alvo ? ` · alvo ${alvo} reps` : ''}</span></div>
          <button type="button" class="ic-btn" id="ex-op" aria-label="Opções do exercício">${ic('menu')}</button>
        </div>
        <div class="tr-ultimo">${ic('historico')}<span>${ult ? `Último treino: <b>${ult}</b>` : 'Primeira vez neste exercício'}</span>${recordeDe[x.nome] ? `<span class="tr-rec">${ic('trofeu')} ${fmt(recordeDe[x.nome])} kg</span>` : ''}</div>

        <div class="tr-tabela" role="table" aria-label="Séries de ${esc(x.nome)}">
          <div class="tr-linha cab" role="row"><span role="columnheader">Série</span><span role="columnheader">Carga (kg)</span><span role="columnheader">Reps</span><span role="columnheader">Feito</span></div>
          ${x.series.map((s, si) => `
            <div class="tr-linha ${s.id ? 'feita' : ''}" role="row">
              <span class="n" role="cell">${s.n}</span>
              <span role="cell"><input class="tr-num" inputmode="decimal" enterkeyhint="next" data-campo="carga" data-si="${si}" value="${fmt(s.carga)}" placeholder="0" aria-label="Carga da série ${s.n} em kg"></span>
              <span role="cell"><input class="tr-num" inputmode="numeric" enterkeyhint="done" data-campo="reps" data-si="${si}" value="${s.reps ?? ''}" placeholder="0" aria-label="Repetições da série ${s.n}"></span>
              <span role="cell"><button type="button" class="tr-feito" data-feito="${si}" aria-pressed="${!!s.id}" aria-label="Série ${s.n} ${s.id ? 'feita, toque para desfazer' : 'feita'}">${ic('check')}</button></span>
            </div>`).join('')}
        </div>
        <button type="button" class="link-btn tr-add-serie" id="add-serie">${ic('mais')} Adicionar série</button>
      </section>` : `
      <section class="card tr-vazio"><h2>Este treino está vazio</h2><p class="mini">Adicione exercícios para começar.</p><button type="button" class="btn primario" id="add-ex-vazio">Adicionar exercício</button></section>`}

      <section class="tr-descanso" id="tr-descanso" aria-label="Tempo de descanso">
        <span class="tr-desc-txt"><span class="tr-desc-rot" id="desc-rot">Tempo de descanso</span>
        <span class="tr-desc-valor" id="desc-valor" role="timer">00:00</span></span>
        <div class="tr-desc-bts">
          <button type="button" data-desc="-15" aria-label="Menos 15 segundos">−15s</button>
          <button type="button" data-desc="play" class="redondo" id="desc-play" aria-label="Começar descanso">${ic('play')}</button>
          <button type="button" data-desc="15" aria-label="Mais 15 segundos">+15s</button>
          <button type="button" data-desc="pular" id="desc-pular">Pular</button>
        </div>
      </section>

      <nav class="tr-rodape" aria-label="Exercícios">
        <button type="button" class="tr-nav ant" id="anterior" ${idx === 0 ? 'disabled' : ''}>${ic('esq')} Anterior</button>
        ${ultimo || !estado.length
          ? `<button type="button" class="tr-nav prox ${completo ? 'destaque' : ''}" id="fim-rodape"><span class="col"><span class="mini">Último exercício</span><span class="t">Finalizar treino</span></span>${ic('check')}</button>`
          : `<button type="button" class="tr-nav prox ${completo ? 'destaque' : ''}" id="proximo"><span class="col"><span class="mini">Próximo exercício</span><span class="t">${esc(prox.nome)}</span></span>${ic('dir')}</button>`}
      </nav>`;

    ligar();
    if (x) tela.querySelector('#tr-descanso').dataset.ocioso = x.descanso * 1000;
    pintarDescanso();
    ligarTique();
  }

  function ligar() {
    const x = estado[idx];
    tela.querySelector('#finalizar').addEventListener('click', finalizar);
    tela.querySelector('#fim-rodape')?.addEventListener('click', finalizar);
    tela.querySelector('#anterior').addEventListener('click', () => irPara(idx - 1));
    tela.querySelector('#proximo')?.addEventListener('click', () => irPara(idx + 1));
    tela.querySelector('#ver-lista').addEventListener('click', listaExercicios);
    tela.querySelector('#add-ex-vazio')?.addEventListener('click', adicionarExercicio);
    tela.querySelectorAll('[data-desc]').forEach((b) => b.addEventListener('click', () => { controleDescanso(b.dataset.desc, x); salvarRascunho(); }));
    if (!x) return;
    tela.querySelector('#play')?.addEventListener('click', (e) => {
      const ex = tela.querySelector('.tr-midia .exec');
      const pausado = ex.classList.toggle('pausado');
      e.currentTarget.innerHTML = ic(pausado ? 'play' : 'pausa');
      e.currentTarget.setAttribute('aria-label', pausado ? 'Animar execução' : 'Pausar animação');
    });
    tela.querySelector('.tr-midia .exec:not(.vazio)')?.addEventListener('click', () => verExecucao(x.nome));
    tela.querySelector('#ex-op').addEventListener('click', () => opcoesExercicio(x));
    tela.querySelector('#add-serie').addEventListener('click', () => {
      const ult = x.series[x.series.length - 1];
      x.series.push({ n: x.series.length + 1, carga: ult?.carga ?? null, reps: ult?.reps ?? x.reps_max ?? 10, id: null });
      salvarRascunho(); desenhar();
    });
    tela.querySelectorAll('.tr-num').forEach((inp) => {
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('input', () => {
        const s = x.series[inp.dataset.si];
        const v = inp.value.trim();
        s[inp.dataset.campo] = v === '' ? null : (inp.dataset.campo === 'reps' ? Math.round(num(v)) : num(v));
        salvarRascunho();
      });
      inp.addEventListener('change', () => {
        const s = x.series[inp.dataset.si];
        if (s.id) q(db.from('treino_series').update({ carga: s.carga, reps: s.reps }).eq('id', s.id)).catch((e) => aviso(e.message));
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (inp.dataset.campo === 'carga') tela.querySelector(`[data-campo="reps"][data-si="${inp.dataset.si}"]`)?.focus();
        else { inp.blur(); tela.querySelector(`[data-feito="${inp.dataset.si}"]`)?.click(); }
      });
    });
    tela.querySelectorAll('[data-feito]').forEach((b) => b.addEventListener('click', () => marcar(Number(b.dataset.feito), b)));
  }

  async function marcar(si, botao) {
    const x = estado[idx];
    const s = x.series[si];
    botao.disabled = true;
    try {
      if (s.id) {
        await q(db.from('treino_series').delete().eq('id', s.id));
        s.id = null;
      } else {
        if (!s.reps) { aviso('Informe as repetições'); botao.disabled = false; return tela.querySelector(`[data-campo="reps"][data-si="${si}"]`)?.focus(); }
        const [r] = await q(db.from('treino_series').insert({ sessao_id: sessaoId, exercicio: x.nome, grupo: x.grupo, serie_n: s.n, carga: s.carga, reps: s.reps }).select('id'));
        s.id = r.id;
        try { navigator.vibrate?.(40); } catch {}
        const carga = Number(s.carga || 0);
        if (recordeDe[x.nome] && carga > recordeDe[x.nome]) {
          aviso(`🏆 Novo recorde: ${fmt(carga)} kg em ${x.nome}`);
          recordesHoje.push(`${x.nome}: ${fmt(carga)} kg`);
          recordeDe[x.nome] = carga;
        }
        const prox = x.series[si + 1];
        if (prox && !prox.id && prox.carga == null) prox.carga = s.carga;
        const ultimaSerieDoTreino = estado.every((e) => e.series.every((z) => z.id));
        if (!ultimaSerieDoTreino) iniciarDescanso(x.descanso, x.nome);
      }
    } catch (e) { aviso(e.message); }
    salvarRascunho();
    desenhar();
  }

  function irPara(i) {
    if (i < 0 || i >= estado.length) return;
    idx = i; salvarRascunho(); desenhar(); window.scrollTo(0, 0);
  }

  async function listaExercicios() {
    const op = await abrirFolha(`
      <div class="cabeca" style="align-items:center"><h2>Exercícios do treino</h2><button type="button" class="ic-btn" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
      <div class="menu-opcoes">${estado.map((e, i) => {
        const f = e.series.filter((s) => s.id).length;
        return `<button type="button" class="menu-op ${i === idx ? 'atual' : ''}" data-ir="${i}">
          <span class="tr-mini-n ${f === e.series.length && f ? 'ok' : ''}">${f === e.series.length && f ? ic('check') : i + 1}</span>
          <span class="col"><span class="t">${esc(e.nome)}</span><span class="mini">${f} de ${e.series.length} séries</span></span></button>`;
      }).join('')}</div>
      <button type="button" class="btn" data-add>${ic('mais')} Adicionar exercício neste treino</button>`,
    (fundo, fechar) => {
      fundo.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => { fechar(null); irPara(Number(b.dataset.ir)); }));
      fundo.querySelector('[data-add]').addEventListener('click', () => { fechar(null); adicionarExercicio(); });
    });
    return op;
  }

  async function adicionarExercicio() {
    const novos = await seletorExercicios(custom, estado.map((e) => e.nome));
    if (!novos?.length) return;
    await carregarHistorico(novos.map((n) => n.nome));
    for (const n of novos) {
      const x = { nome: n.nome, grupo: n.grupo, alvo: 3, reps_min: 8, reps_max: 12, descanso: 90 };
      x.series = [1, 2, 3].map((k) => prefill(x, k));
      estado.push(x);
    }
    idx = estado.length - novos.length;
    salvarRascunho(); desenhar();
  }

  async function opcoesExercicio(x) {
    const op = await escolher(x.nome, [
      { v: 'trocar', t: 'Trocar exercício (só hoje)', ic: 'troca' },
      { v: 'descanso', t: `Descanso: ${x.descanso}s`, ic: 'relogio' },
      { v: 'evolucao', t: 'Ver evolução deste exercício', ic: 'grafico' },
      ...(x.series.length > 1 && !x.series[x.series.length - 1].id ? [{ v: 'tirar', t: 'Remover última série', ic: 'lixo' }] : []),
      ...(!x.series.some((s) => s.id) ? [{ v: 'remover', t: 'Tirar exercício deste treino', ic: 'lixo', perigo: true }] : [])
    ]);
    if (op === 'trocar') {
      if (x.series.some((s) => s.id)) return aviso('Desmarque as séries feitas antes de trocar');
      const [novo] = (await seletorExercicios(custom, estado.map((e) => e.nome), true)) || [];
      if (!novo) return;
      await carregarHistorico([novo.nome]);
      x.nome = novo.nome; x.grupo = novo.grupo;
      x.series = x.series.map((s) => prefill(x, s.n));
      salvarRascunho(); desenhar();
    } else if (op === 'descanso') {
      const v = await abrirFolha(`<h2>Descanso de ${esc(x.nome)}</h2><form class="form"><div class="tr-chips-dias">${[30, 45, 60, 90, 120, 180].map((s) => `<button class="tr-chip-dia" name="seg" value="${s}" aria-pressed="${s === x.descanso}">${s >= 60 ? (s / 60).toString().replace('.', ',') + ' min' : s + 's'}</button>`).join('')}</div><button type="button" class="btn" data-fechar>Cancelar</button></form>`);
      if (v?.acao) { x.descanso = Number(v.acao); salvarRascunho(); desenhar(); }
    } else if (op === 'evolucao') ir(`#/treino?exercicio=${encodeURIComponent(x.nome)}`);
    else if (op === 'tirar') { x.series.pop(); salvarRascunho(); desenhar(); }
    else if (op === 'remover') { estado.splice(idx, 1); idx = Math.max(0, Math.min(idx, estado.length - 1)); salvarRascunho(); desenhar(); }
  }

  async function finalizar() {
    const { feitasN, volume } = totais();
    const minutos = Math.max(1, Math.round((Date.now() - inicioMs) / 60000));
    const pendentes = estado.reduce((t, x) => t + x.series.filter((s) => !s.id).length, 0);
    const v = await abrirFolha(`
      <h2>${feitasN ? 'Finalizar treino' : 'Nenhuma série feita'}</h2>
      ${feitasN ? `
      <div class="tr-resumo">
        <span><b>${minutos} min</b><span class="mini">duração</span></span>
        <span><b>${feitasN}</b><span class="mini">séries</span></span>
        <span><b>${Math.round(volume).toLocaleString('pt-BR')} kg</b><span class="mini">volume</span></span>
      </div>
      ${recordesHoje.length ? `<p class="tr-recordes">${ic('trofeu')} ${recordesHoje.map(esc).join(' · ')}</p>` : ''}
      ${pendentes ? `<p class="mini" style="margin:0">${plural(pendentes, 'série não foi marcada e não entra', 'séries não foram marcadas e não entram')} no histórico.</p>` : ''}` : '<p class="mini" style="margin:0">Se finalizar agora, este treino é descartado.</p>'}
      <form class="form">
        ${feitasN ? `
        <div class="campo"><label for="f-esf">Esforço (1 leve a 10 máximo)</label><input id="f-esf" name="esforco" type="number" min="1" max="10" inputmode="numeric"></div>
        <div class="campo"><label for="f-notas">Como foi?</label><input id="f-notas" name="notas" placeholder="opcional"></div>` : ''}
        <div class="grade-2"><button type="button" class="btn" data-fechar>Continuar treinando</button><button class="btn primario">${feitasN ? 'Finalizar' : 'Descartar'}</button></div>
      </form>`);
    if (!v) return;
    try {
      if (feitasN) {
        const fim = new Date();
        await q(db.from('treino_sessoes').update({
          fim: fim.toISOString(), duracao_min: Math.max(1, Math.round((fim - inicioMs) / 60000)),
          esforco: v.esforco ? Math.min(10, Math.max(1, Math.round(num(v.esforco)))) : null, notas: v.notas || null
        }).eq('id', sessaoId));
      } else await q(db.from('treino_sessoes').delete().eq('id', sessaoId));
    } catch (e) { return aviso(e.message); }
    pararDescanso();
    gravar(chaveRascunho(sessaoId), null);
    gravar(ATIVO, null);
    aviso(feitasN ? 'Treino salvo 💪' : 'Treino descartado');
    ir(feitasN ? '#/treino?evolucao=historico' : '#/treino');
  }

  desenhar();
}

// ---------- descanso (sobrevive a recarregar o app) ----------
const restante = () => (!descanso ? 0 : descanso.pausa != null ? descanso.pausa : Math.max(0, descanso.fim - Date.now()));

function iniciarDescanso(seg, exercicio) {
  descanso = { fim: Date.now() + seg * 1000, total: seg * 1000, pausa: null, exercicio };
  gravar(CHAVE_DESCANSO, descanso);
  pintarDescanso();
  ligarTique();
}
function pararDescanso() {
  descanso = null;
  gravar(CHAVE_DESCANSO, null);
  pintarDescanso();
}
function controleDescanso(acao, x) {
  if (!descanso) {
    if (!x) return;
    if (acao === 'play') return iniciarDescanso(x.descanso, x.nome);
    if (acao === '-15' || acao === '15') { x.descanso = Math.max(15, x.descanso + Number(acao)); pintarDescanso(x.descanso * 1000); }
    return;
  }
  if (acao === 'pular') return pararDescanso();
  if (acao === 'play') {
    if (descanso.pausa != null) { descanso.fim = Date.now() + descanso.pausa; descanso.pausa = null; }
    else descanso.pausa = restante();
  } else {
    const d = Number(acao) * 1000;
    if (descanso.pausa != null) descanso.pausa = Math.max(1000, descanso.pausa + d);
    else descanso.fim = Math.max(Date.now() + 1000, descanso.fim + d);
  }
  gravar(CHAVE_DESCANSO, descanso);
  pintarDescanso();
}
function pintarDescanso(ociosoMs) {
  const box = document.getElementById('tr-descanso');
  if (!box) return;
  const ativo = !!descanso;
  box.classList.toggle('ativo', ativo);
  const ms = ativo ? restante() : (ociosoMs ?? (Number(box.dataset.ocioso) || 0));
  if (!ativo && ociosoMs != null) box.dataset.ocioso = ociosoMs;
  document.getElementById('desc-valor').textContent = duracaoTxt(ativo ? ms + 999 : Number(box.dataset.ocioso));
  document.getElementById('desc-rot').textContent = ativo ? (descanso.pausa != null ? 'Descanso pausado' : 'Tempo de descanso') : 'Tempo de descanso';
  const play = document.getElementById('desc-play');
  const pausado = !ativo || descanso.pausa != null;
  play.innerHTML = ic(pausado ? 'play' : 'pausa');
  play.setAttribute('aria-label', !ativo ? 'Começar descanso agora' : pausado ? 'Continuar descanso' : 'Pausar descanso');
  document.getElementById('desc-pular').disabled = !ativo;
}
function ligarTique() {
  if (tique) return;
  tique = setInterval(() => {
    const rel = document.getElementById('tr-relogio');
    const at = ler(ATIVO);
    if (rel && at) rel.textContent = duracaoTxt(Date.now() - at.inicio);
    if (descanso && descanso.pausa == null && restante() <= 0) {
      const ex = descanso.exercicio;
      pararDescanso();
      alertaFimDescanso(ex);
    } else pintarDescanso();
    if (!rel && !descanso) { clearInterval(tique); tique = null; }
  }, 250);
}

function alertaFimDescanso(exercicio) {
  try { navigator.vibrate?.([300, 120, 300, 120, 500]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    const at = ler(ATIVO);
    navigator.serviceWorker.ready.then((reg) => reg.showNotification('⏱️ Descanso acabou', {
      body: `Próxima série · ${exercicio || ''}`, tag: 'descanso', renotify: true, vibrate: [300, 120, 300],
      icon: '/icons/icon-192.png', data: { link: at ? `/#/treino?treinar=${at.id}` : '/#/treino' }
    })).catch(() => {});
  }
}

// ======================================================================
// 5. Evolução e histórico
// ======================================================================
const PERIODOS = [[7, 'Últimos 7 dias'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [365, 'Último ano']];

async function evolucao(tela, aba) {
  const dias = Number(ler('arca-treino-periodo')) || 30;
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const [treinos, sessoes] = await Promise.all([
    q(db.from('treinos').select('id,dias').eq('ativo', true)),
    q(db.from('treino_sessoes').select('id,treino_id,nome,tipo,inicio,fim,duracao_min,distancia_km,esforco,notas').not('fim', 'is', null)
      .gte('inicio', aba === 'historico' ? new Date(Date.now() - 365 * 86400000).toISOString() : desde).order('inicio', { ascending: false }).limit(300))
  ]);
  const ids = sessoes.map((s) => s.id);
  const series = ids.length ? await q(db.from('treino_series').select('sessao_id,exercicio,grupo,carga,reps,feito_em').in('sessao_id', ids).order('feito_em').limit(5000)) : [];

  const abas = [['resumo', 'Resumo'], ['exercicios', 'Exercícios'], ['historico', 'Histórico']];
  let corpo = '';
  if (aba === 'historico') corpo = historicoHTML(sessoes, series);
  else if (aba === 'exercicios') corpo = exerciciosHTML(series);
  else corpo = resumoHTML(sessoes, series, treinos, dias);

  tela.innerHTML = `
    <header class="tr-cab">
      <a class="ic-btn" href="#/treino" aria-label="Voltar aos treinos">${ic('voltar')}</a>
      <h1>Evolução</h1>
      <span style="width:44px"></span>
    </header>
    <nav class="tr-abas" aria-label="Seções">${abas.map(([k, n]) => `<a href="#/treino?evolucao=${k}" ${k === aba ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
    ${aba !== 'historico' ? `<label class="tr-periodo">${ic('calendario')}<select id="periodo" aria-label="Período">${PERIODOS.map(([d, n]) => `<option value="${d}" ${d === dias ? 'selected' : ''}>${n}</option>`).join('')}</select>${ic('baixo')}</label>` : ''}
    ${corpo}`;

  tela.querySelector('#periodo')?.addEventListener('change', (e) => {
    gravar('arca-treino-periodo', Number(e.target.value));
    evolucao(tela, aba);
  });
  tela.querySelectorAll('[data-sessao]').forEach((b) => b.addEventListener('click', () => detalheSessao(sessoes.find((s) => s.id === b.dataset.sessao), series.filter((x) => x.sessao_id === b.dataset.sessao), () => evolucao(tela, aba))));
}

// melhor carga por sessão, por exercício (ordem cronológica)
function porExercicio(series) {
  const m = new Map();
  for (const s of series) {
    if (!m.has(s.exercicio)) m.set(s.exercicio, new Map());
    const ses = m.get(s.exercicio);
    const atual = ses.get(s.sessao_id) || { data: s.feito_em, carga: 0, rm: 0, grupo: s.grupo };
    atual.carga = Math.max(atual.carga, Number(s.carga || 0));
    atual.rm = Math.max(atual.rm, umRM(s.carga, s.reps));
    ses.set(s.sessao_id, atual);
  }
  return [...m.entries()].map(([nome, ses]) => {
    const lista = [...ses.values()].sort((a, b) => new Date(a.data) - new Date(b.data));
    const primeira = lista[0], ultima = lista[lista.length - 1];
    return { nome, grupo: primeira.grupo, sessoes: lista.length, primeira: primeira.carga, ultima: ultima.carga, maior: Math.max(...lista.map((x) => x.carga)), rm: Math.max(...lista.map((x) => x.rm)), quando: ultima.data };
  });
}

function resumoHTML(sessoes, series, treinos, dias) {
  const kcal = Math.round(sessoes.reduce((t, s) => t + (s.tipo === 'corrida' && s.distancia_km ? Number(s.distancia_km) * 65 : (s.duracao_min || 0) * (s.tipo === 'musculacao' ? 6 : 8)), 0));
  const ex = porExercicio(series);
  const comEvol = ex.filter((e) => e.sessoes >= 2 && e.primeira > 0);
  const evolMedia = comEvol.length ? Math.round(comEvol.reduce((t, e) => t + (e.ultima - e.primeira) / e.primeira, 0) / comEvol.length * 100) : null;
  const planejados = new Set(treinos.flatMap((t) => t.dias || []));
  const porSemana = planejados.size || 3;
  const esperado = Math.max(1, Math.round((porSemana * dias) / 7));
  const freq = Math.min(100, Math.round((sessoes.length / esperado) * 100));
  const contagem = Array(7).fill(0);
  sessoes.forEach((s) => { contagem[new Date(s.inicio).getDay()]++; });
  const max = Math.max(1, ...contagem);
  const top = comEvol.map((e) => ({ ...e, pct: Math.round(((e.ultima - e.primeira) / e.primeira) * 100) })).filter((e) => e.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const sinal = (n) => (n > 0 ? '+' : '') + n;

  return `
    <section class="tr-kpis">
      <div class="tr-kpi">${ic('calendario', 'k-verde')}<b>${sessoes.length}</b><span class="mini">Treinos</span></div>
      <div class="tr-kpi">${ic('fogo', 'k-fogo')}<b>${kcal.toLocaleString('pt-BR')}</b><span class="mini">Calorias (estim.)</span></div>
      <div class="tr-kpi">${ic('tendencia', 'k-verde')}<b>${evolMedia == null ? '—' : sinal(evolMedia) + '%'}</b><span class="mini">Evolução de carga</span></div>
      <div class="tr-kpi">${ic('barras', 'k-verde')}<b>${freq}%</b><span class="mini">Frequência</span></div>
    </section>

    <section class="card tr-freq" aria-labelledby="h-freq">
      <h2 id="h-freq">Frequência semanal</h2>
      <div class="tr-graf" role="img" aria-label="Treinos por dia da semana: ${ORDEM_SEMANA.map((d) => `${DIAS_LONGOS[d]} ${contagem[d]}`).join(', ')}">
        ${ORDEM_SEMANA.map((d) => `
          <span class="tr-col"><span class="tr-qtd">${contagem[d] || ''}</span><span class="tr-bar ${planejados.has(d) ? 'plan' : ''}" style="height:${contagem[d] ? Math.max(8, (contagem[d] / max) * 100) : 4}%"></span><span class="tr-dia-rot">${DIAS[d]}</span></span>`).join('')}
      </div>
      ${planejados.size ? `<span class="mini tr-legenda"><i class="plan"></i> dias do seu plano <i></i> outros dias</span>` : ''}
    </section>

    <section class="card tr-evols" aria-labelledby="h-evol">
      <h2 id="h-evol">Principais evoluções</h2>
      ${top.length ? top.map((e) => `
        <a class="tr-evol" href="#/treino?exercicio=${encodeURIComponent(e.nome)}">
          <span class="tr-evol-ic">${ic('seta')}</span>
          <span class="col"><span class="t">${esc(e.nome)}</span><span class="mini">+${fmt(e.ultima - e.primeira)} kg (${fmt(e.primeira)} → ${fmt(e.ultima)} kg)</span></span>
          <span class="tr-evol-pct">+${e.pct}%</span>
        </a>`).join('') : '<p class="mini" style="margin:0">Repita um exercício em pelo menos dois treinos do período para ver a evolução de carga.</p>'}
    </section>
    <p class="mini" style="margin:0">Calorias estimadas pela duração (cerca de 6 kcal por minuto de musculação). Frequência: treinos feitos em relação aos dias do seu plano${planejados.size ? '' : ' (3 por semana, enquanto os treinos não têm dias marcados)'}.</p>`;
}

function exerciciosHTML(series) {
  const ex = porExercicio(series).sort((a, b) => new Date(b.quando) - new Date(a.quando));
  if (!ex.length) return '<p class="vazio">Nenhum exercício registrado no período.</p>';
  return `<section class="card tr-lista">${ex.map((e) => `
    <a class="tr-item-link" href="#/treino?exercicio=${encodeURIComponent(e.nome)}">
      ${foto(e.nome) ? `<span class="tr-thumb"><img src="${foto(e.nome)}" alt="" loading="lazy"></span>` : `<span class="tr-thumb vazio">${ic('haltere')}</span>`}
      <span class="col"><span class="t">${esc(e.nome)}</span><span class="mini">Maior carga ${kg(e.maior)} · ${plural(e.sessoes, 'treino', 'treinos')}</span></span>
      ${ic('dir', 'seta')}
    </a>`).join('')}</section>`;
}

function historicoHTML(sessoes, series) {
  if (!sessoes.length) return '<p class="vazio">Seus treinos finalizados aparecem aqui.</p>';
  const porSessao = {};
  series.forEach((s) => { (porSessao[s.sessao_id] ||= []).push(s); });
  const meses = new Map();
  sessoes.forEach((s) => {
    const d = new Date(s.inicio); const m = d.toLocaleDateString('pt-BR', { month: 'long' });
    const k = m.charAt(0).toUpperCase() + m.slice(1) + ' de ' + d.getFullYear();
    if (!meses.has(k)) meses.set(k, []);
    meses.get(k).push(s);
  });
  return [...meses.entries()].map(([mes, lista]) => `
    <section class="card tr-lista" aria-label="${mes}">
      <h2 class="tr-mes">${mes}</h2>
      ${lista.map((s) => {
        const ss = porSessao[s.id] || [];
        const vol = ss.reduce((v, x) => v + Number(x.carga || 0) * Number(x.reps || 0), 0);
        const d = new Date(s.inicio);
        return `<button type="button" class="tr-item-link" data-sessao="${s.id}">
          <span class="tr-data"><b>${d.getDate()}</b><span>${DIAS[d.getDay()]}</span></span>
          <span class="col"><span class="t">${esc(s.nome)}</span><span class="mini">${[s.duracao_min ? s.duracao_min + ' min' : '', ss.length ? plural(ss.length, 'série', 'séries') : '', vol ? Math.round(vol).toLocaleString('pt-BR') + ' kg' : '', s.distancia_km ? fmt(s.distancia_km) + ' km' : ''].filter(Boolean).join(' · ')}</span></span>
          ${ic('dir', 'seta')}
        </button>`;
      }).join('')}
    </section>`).join('');
}

async function detalheSessao(s, series, recarregar) {
  const grupos = new Map();
  series.forEach((x) => { if (!grupos.has(x.exercicio)) grupos.set(x.exercicio, []); grupos.get(x.exercicio).push(x); });
  const v = await abrirFolha(`
    <div class="cabeca" style="align-items:center"><h2>${esc(s.nome)}</h2><button type="button" class="ic-btn" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
    <p class="mini" style="margin:0">${new Date(s.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}${s.duracao_min ? ' · ' + s.duracao_min + ' min' : ''}${s.esforco ? ' · esforço ' + s.esforco + '/10' : ''}</p>
    ${s.notas ? `<p style="margin:0">${esc(s.notas)}</p>` : ''}
    ${[...grupos.entries()].map(([nome, l]) => `<div class="linha"><span class="col"><span class="t">${esc(nome)}</span><span class="mini">${l.map((x) => (Number(x.carga) ? fmt(x.carga) + '×' : '') + x.reps).join(' · ')}</span></span></div>`).join('')}
    <form class="form"><button class="btn perigo-txt" value="apagar">${ic('lixo')} Apagar este treino do histórico</button></form>`);
  if (v?.acao !== 'apagar') return;
  const ok = await abrirFolha(`<h2>Apagar do histórico?</h2><p class="mini" style="margin:0">As séries deste dia somem da evolução. Não dá para desfazer.</p><form class="form"><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario perigo">Apagar</button></div></form>`);
  if (!ok) return;
  await q(db.from('treino_sessoes').delete().eq('id', s.id));
  aviso('Treino apagado do histórico');
  recarregar();
}

// ======================================================================
// Evolução de um exercício
// ======================================================================
async function historicoExercicio(tela, nome) {
  const series = await q(db.from('treino_series').select('sessao_id,serie_n,carga,reps,feito_em').eq('exercicio', nome).order('feito_em', { ascending: false }).limit(400));
  const porSessao = new Map();
  for (const s of series) {
    if (!porSessao.has(s.sessao_id)) porSessao.set(s.sessao_id, { data: s.feito_em, series: [] });
    porSessao.get(s.sessao_id).series.push(s);
  }
  const sessoes = [...porSessao.values()].map((x) => {
    x.series.sort((a, b) => a.serie_n - b.serie_n);
    x.rm = Math.max(...x.series.map((s) => umRM(s.carga, s.reps)));
    x.cargaMax = Math.max(...x.series.map((s) => Number(s.carga || 0)));
    return x;
  });
  const recorde = sessoes.reduce((m, x) => Math.max(m, x.cargaMax), 0);
  const rmMax = sessoes.reduce((m, x) => Math.max(m, x.rm), 0);
  const graf = [...sessoes].reverse().slice(-12);

  let svg = '';
  if (graf.length >= 2) {
    const W = 300, H = 110, Pd = 10;
    const vals = graf.map((x) => x.rm);
    const min = Math.min(...vals), max = Math.max(...vals), amp = max - min || 1;
    const pts = vals.map((v, i) => [Pd + (i * (W - 2 * Pd)) / (vals.length - 1), H - Pd - ((v - min) / amp) * (H - 2 * Pd)]);
    svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Força estimada nos últimos ${vals.length} treinos, de ${Math.round(vals[0])} a ${Math.round(vals[vals.length - 1])} kg" style="width:100%;height:auto">
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--verde)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--verde)"/>`).join('')}
    </svg>`;
  }
  const eq = equipamento(nome);

  tela.innerHTML = `
    <header class="tr-cab">
      <button type="button" class="ic-btn" id="voltar" aria-label="Voltar">${ic('voltar')}</button>
      <h1>${esc(nome)}</h1>
      <span style="width:44px"></span>
    </header>
    ${execucao(nome, 'grande')}
    ${eq ? `<p class="mini" style="margin:0">Equipamento: ${esc(eq)}</p>` : ''}
    <section class="tr-kpis">
      <div class="tr-kpi">${ic('trofeu')}<b>${recorde ? kg(recorde) : '—'}</b><span class="mini">Maior carga</span></div>
      <div class="tr-kpi">${ic('tendencia')}<b>${rmMax ? kg(Math.round(rmMax)) : '—'}</b><span class="mini">Força estimada (1RM)</span></div>
    </section>
    ${svg ? `<section class="card" style="display:flex;flex-direction:column;gap:6px"><h2 style="font-size:15px;margin:0">Evolução da força estimada</h2>${svg}</section>` : ''}
    <section class="card lista">
      <h2 style="margin:10px 0 4px;font-size:15px">Treinos</h2>
      ${sessoes.map((x) => `
        <div class="linha"><span class="col"><span class="t">${dataCurta(x.data.slice(0, 10))}</span>
        <span class="mini">${x.series.map((s) => `${fmt(s.carga) || 0}×${s.reps}`).join(' · ')}</span></span>
        <span class="v" style="font-size:13px">${x.cargaMax === recorde && recorde ? '🏆 ' : ''}${kg(x.cargaMax)}</span></div>`).join('') || '<p class="vazio">Ainda sem séries registradas.</p>'}
    </section>
    <p class="mini" style="margin:0">Força estimada pela fórmula de Epley (carga × (1 + reps/30)), a partir da melhor série de cada treino.</p>`;
  tela.querySelector('#voltar').addEventListener('click', () => (history.length > 1 ? history.back() : ir('#/treino')));
}

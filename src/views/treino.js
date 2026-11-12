// Sala Treino: montar treinos, treinar com cargas da última vez e acompanhar a evolução.
import { db, q } from '../db.js';
import { esc, aviso, folha, dataCurta } from '../util.js';
import { GRUPOS, TIPOS, DIAS, DIAS_LONGOS, umRM, kg } from '../exercicios.js';
import { execucao, temExecucao } from '../execucoes.js';

// Toque na miniatura: mostra a execução em tamanho grande
function verExecucao(nome) {
  folha(`<div class="cabeca" style="align-items:center"><h2>${esc(nome)}</h2><button type="button" class="btn pequeno" data-fechar>Fechar</button></div>${execucao(nome, 'grande')}<p class="mini" style="margin:0">Início e fim do movimento. Desça controlando e suba com força.</p>`);
}
function ligarExecucoes(raiz) {
  raiz.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); verExecucao(b.dataset.exec); }));
}
const miniExec = (nome) => temExecucao(nome) ? `<button type="button" class="exec-btn" data-exec="${esc(nome)}" aria-label="Ver execução de ${esc(nome)}">${execucao(nome, 'mini')}</button>` : '';

const ir = (hash) => { location.hash = hash; };
const num = (s) => Number(String(s ?? '').replace(',', '.')) || 0;

export default async function treino(tela, { params }) {
  if (params.get('treinar')) return modoTreinar(tela, params.get('treinar'));
  if (params.get('editar')) return editor(tela, params.get('editar'));
  if (params.get('exercicio')) return historicoExercicio(tela, params.get('exercicio'));
  return lista(tela);
}

// ================= Lista de treinos + resumo =================
async function lista(tela) {
  const [treinos, sessoes] = await Promise.all([
    q(db.from('treinos').select('id,nome,tipo,dias,ordem,treino_exercicios(count)').eq('ativo', true).order('ordem').order('criado_em')),
    q(db.from('treino_sessoes').select('id,nome,tipo,inicio,fim,duracao_min,distancia_km,treino_series(count)').order('inicio', { ascending: false }).limit(8))
  ]);
  const hojeDia = new Date().getDay();
  const doDia = treinos.filter((t) => (t.dias || []).includes(hojeDia));
  const seteDias = sessoes.filter((s) => Date.now() - new Date(s.inicio) < 7 * 86400000).length;
  const emAndamento = sessoes.find((s) => !s.fim && Date.now() - new Date(s.inicio) < 6 * 3600000);

  tela.innerHTML = `
    <header class="cabeca" style="align-items:center"><h1>Treino</h1><button type="button" class="btn pequeno suave" id="novo">+ Treino</button></header>

    ${emAndamento ? `
    <a class="card" href="#/treino?treinar=${emAndamento.id}" style="text-decoration:none;color:inherit;display:flex;justify-content:space-between;align-items:center;border-color:var(--verde)">
      <span><span class="mini" style="font-weight:700">Em andamento</span><br><span style="font-weight:800">${esc(emAndamento.nome)}</span></span>
      <span class="btn pequeno primario">Continuar</span>
    </a>` : ''}

    <section class="grade-2">
      <div class="kpi"><span class="mini" style="font-weight:600">Últimos 7 dias</span><span class="n">${seteDias}</span><span class="mini">${seteDias === 1 ? 'treino' : 'treinos'}</span></div>
      <div class="kpi"><span class="mini" style="font-weight:600">Hoje (${DIAS_LONGOS[hojeDia]})</span><span class="n" style="font-size:16px">${doDia.length ? esc(doDia.map((t) => t.nome).join(', ')) : 'livre'}</span></div>
    </section>

    <section aria-labelledby="h-treinos" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="h-treinos">Meus treinos</h2>
      ${treinos.length ? treinos.map((t) => `
        <div class="card" style="display:flex;flex-direction:column;gap:10px;padding:14px">
          <div class="cabeca"><span style="font-weight:800;font-size:15px">${esc(t.nome)}</span><span class="etiqueta">${TIPOS[t.tipo]}</span></div>
          <span class="mini">${t.tipo === 'musculacao' ? `${t.treino_exercicios?.[0]?.count || 0} exercícios` : 'registro livre'}${t.dias?.length ? ' · ' + t.dias.map((d) => DIAS_LONGOS[d]).join(', ') : ''}</span>
          <div class="grade-2"><button type="button" class="btn" data-editar="${t.id}">Editar</button><button type="button" class="btn primario" data-treinar="${t.id}" data-tipo="${t.tipo}">Treinar</button></div>
        </div>`).join('') : `<p class="mini" style="margin:0;line-height:1.5">Monte seu primeiro treino: Treino A (peito e tríceps), Treino B (costas e bíceps)… Também dá para registrar corrida, cardio e funcional.</p>`}
      <button type="button" class="btn" id="avulso">Registrar atividade avulsa (corrida, cardio…)</button>
    </section>

    <section class="card lista" aria-labelledby="h-hist">
      <h2 id="h-hist" style="margin:10px 0 4px;font-size:15px">Últimos treinos</h2>
      ${sessoes.filter((s) => s.fim).map((s) => `
        <div class="linha"><span class="col"><span class="t">${esc(s.nome)}</span><span class="mini">${dataCurta(s.inicio.slice(0, 10))}${s.duracao_min ? ' · ' + s.duracao_min + ' min' : ''}${s.distancia_km ? ' · ' + String(s.distancia_km).replace('.', ',') + ' km' : ''}${s.treino_series?.[0]?.count ? ' · ' + s.treino_series[0].count + ' séries' : ''}</span></span></div>`).join('') || '<p class="vazio">Seus treinos aparecem aqui.</p>'}
    </section>`;

  tela.querySelector('#novo').addEventListener('click', novoTreino);
  tela.querySelector('#avulso').addEventListener('click', () => registrarLivre(null));
  tela.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => ir(`#/treino?editar=${b.dataset.editar}`)));
  tela.querySelectorAll('[data-treinar]').forEach((b) => b.addEventListener('click', async () => {
    const t = treinos.find((x) => x.id === b.dataset.treinar);
    if (t.tipo !== 'musculacao') return registrarLivre(t);
    b.disabled = true;
    try {
      const [s] = await q(db.from('treino_sessoes').insert({ treino_id: t.id, nome: t.nome, tipo: t.tipo }).select('id'));
      ir(`#/treino?treinar=${s.id}`);
    } catch (e) { aviso(e.message); b.disabled = false; }
  }));
}

async function novoTreino() {
  const v = await folha(`
    <h2>Novo treino</h2>
    <form class="form">
      <div class="campo"><label for="t-nome">Nome</label><input id="t-nome" name="nome" placeholder="Ex.: Treino A · Peito e tríceps" required></div>
      <div class="campo"><label for="t-tipo">Tipo</label><select id="t-tipo" name="tipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
      <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Criar</button></div>
    </form>`);
  if (!v) return;
  const [t] = await q(db.from('treinos').insert({ nome: v.nome, tipo: v.tipo }).select('id'));
  ir(`#/treino?editar=${t.id}`);
}

// Corrida, cardio, funcional: registro simples
async function registrarLivre(t) {
  const v = await folha(`
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
  }));
  aviso('Atividade registrada');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ================= Editor do treino =================
async function editor(tela, id) {
  const [[t], exs, custom] = await Promise.all([
    q(db.from('treinos').select('id,nome,tipo,dias,notas').eq('id', id)),
    q(db.from('treino_exercicios').select('id,nome,grupo,ordem,series,reps_min,reps_max,descanso_seg,notas').eq('treino_id', id).order('ordem').order('criado_em')),
    q(db.from('exercicios_custom').select('nome,grupo').order('nome'))
  ]);
  if (!t) return ir('#/treino');
  const recarregar = () => editor(tela, id);

  tela.innerHTML = `
    <header class="cabeca" style="align-items:center"><a href="#/treino" class="btn pequeno">← Treinos</a><button type="button" class="btn pequeno" id="apagar" style="color:var(--vermelho)">Apagar treino</button></header>
    <section class="card form" style="padding:16px">
      <div class="campo"><label for="e-nome">Nome</label><input id="e-nome" value="${esc(t.nome)}"></div>
      <div class="campo"><label>Dias da semana</label>
        <div class="chips">${DIAS.map((d, i) => `<button type="button" class="chip" data-dia="${i}" aria-pressed="${(t.dias || []).includes(i)}" aria-label="${DIAS_LONGOS[i]}" style="min-width:40px;text-align:center">${d}</button>`).join('')}</div>
      </div>
    </section>

    ${t.tipo === 'musculacao' ? `
    <section aria-labelledby="h-ex" style="display:flex;flex-direction:column;gap:10px">
      <div class="cabeca"><h2 id="h-ex">Exercícios</h2><span class="mini">${exs.length}</span></div>
      ${exs.map((e, i) => `
        <div class="card" style="display:flex;flex-direction:column;gap:10px;padding:12px 14px">
          <div class="cabeca" style="align-items:center">
            <span style="display:flex;gap:10px;align-items:center">${miniExec(e.nome)}<span><span style="font-weight:800;font-size:14px">${i + 1}. ${esc(e.nome)}</span><br><span class="mini">${esc(e.grupo || '')}</span></span></span>
            <span style="display:flex;gap:4px">
              <button type="button" class="btn-editar" data-subir="${e.id}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn-editar" data-descer="${e.id}" aria-label="Descer" ${i === exs.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn-editar" data-tirar="${e.id}" aria-label="Tirar ${esc(e.nome)}">×</button>
            </span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
            <div class="campo"><label>Séries</label><input inputmode="numeric" data-campo="series" data-id="${e.id}" value="${e.series}"></div>
            <div class="campo"><label>Reps mín</label><input inputmode="numeric" data-campo="reps_min" data-id="${e.id}" value="${e.reps_min ?? ''}"></div>
            <div class="campo"><label>Reps máx</label><input inputmode="numeric" data-campo="reps_max" data-id="${e.id}" value="${e.reps_max ?? ''}"></div>
            <div class="campo"><label>Descanso</label><input inputmode="numeric" data-campo="descanso_seg" data-id="${e.id}" value="${e.descanso_seg}" aria-label="Descanso em segundos"></div>
          </div>
        </div>`).join('') || '<p class="mini" style="margin:0">Nenhum exercício ainda.</p>'}
      <button type="button" class="btn primario" id="add-ex">+ Adicionar exercício</button>
      <p class="mini" style="margin:0">Descanso em segundos. As alterações são salvas na hora.</p>
    </section>` : `<p class="mini" style="margin:0;line-height:1.5">Treinos de ${TIPOS[t.tipo].toLowerCase()} são registrados com duração, distância e esforço ao tocar em "Treinar".</p>`}`;

  ligarExecucoes(tela);
  // Nome e dias
  tela.querySelector('#e-nome').addEventListener('change', async (ev) => {
    await q(db.from('treinos').update({ nome: ev.target.value.trim() || t.nome }).eq('id', id)).catch((e) => aviso(e.message));
  });
  tela.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', async () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    const dias = [...tela.querySelectorAll('[data-dia][aria-pressed="true"]')].map((x) => Number(x.dataset.dia));
    await q(db.from('treinos').update({ dias }).eq('id', id)).catch((e) => aviso(e.message));
  }));
  tela.querySelector('#apagar').addEventListener('click', async () => {
    const v = await folha(`<h2>Apagar "${esc(t.nome)}"?</h2><p class="mini" style="margin:0">O histórico dos treinos já feitos continua guardado.</p><form class="form"><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Apagar</button></div></form>`);
    if (!v) return;
    await q(db.from('treinos').update({ ativo: false }).eq('id', id));
    ir('#/treino');
  });
  if (t.tipo !== 'musculacao') return;

  // Campos dos exercícios
  tela.querySelectorAll('[data-campo]').forEach((inp) => inp.addEventListener('change', async () => {
    const valor = inp.value.trim() === '' ? null : Math.max(0, Math.round(num(inp.value)));
    await q(db.from('treino_exercicios').update({ [inp.dataset.campo]: valor ?? (inp.dataset.campo === 'series' ? 3 : inp.dataset.campo === 'descanso_seg' ? 90 : null) }).eq('id', inp.dataset.id)).catch((e) => aviso(e.message));
  }));
  const reordenar = async (lista) => {
    await Promise.all(lista.map((e, i) => q(db.from('treino_exercicios').update({ ordem: i }).eq('id', e.id))));
    recarregar();
  };
  tela.querySelectorAll('[data-subir]').forEach((b) => b.addEventListener('click', () => {
    const i = exs.findIndex((e) => e.id === b.dataset.subir); const l = [...exs];
    [l[i - 1], l[i]] = [l[i], l[i - 1]]; reordenar(l);
  }));
  tela.querySelectorAll('[data-descer]').forEach((b) => b.addEventListener('click', () => {
    const i = exs.findIndex((e) => e.id === b.dataset.descer); const l = [...exs];
    [l[i + 1], l[i]] = [l[i], l[i + 1]]; reordenar(l);
  }));
  tela.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', async () => {
    await q(db.from('treino_exercicios').delete().eq('id', b.dataset.tirar));
    recarregar();
  }));
  tela.querySelector('#add-ex').addEventListener('click', async () => {
    const escolhidos = await seletorExercicios(custom, exs.map((e) => e.nome));
    if (!escolhidos?.length) return;
    await q(db.from('treino_exercicios').insert(escolhidos.map((x, i) => ({
      treino_id: id, nome: x.nome, grupo: x.grupo, ordem: exs.length + i, series: 3, reps_min: 8, reps_max: 12, descanso_seg: 90
    }))));
    recarregar();
  });
}

// Lista pesquisável por grupo muscular; permite marcar vários e criar exercício novo
function seletorExercicios(custom, jaNoTreino) {
  return new Promise((resolve) => {
    const grupos = { ...GRUPOS };
    if (custom.length) grupos['Meus exercícios'] = custom.map((c) => c.nome);
    const grupoDe = {};
    Object.entries(GRUPOS).forEach(([g, l]) => l.forEach((n) => { grupoDe[n] = g; }));
    custom.forEach((c) => { grupoDe[c.nome] = c.grupo; });
    const marcados = new Set();

    const fundo = document.createElement('div');
    fundo.className = 'folha-fundo';
    fundo.innerHTML = `
      <div class="folha" role="dialog" aria-modal="true" aria-label="Escolher exercícios" style="gap:10px">
        <div class="cabeca" style="align-items:center"><h2>Exercícios</h2><button type="button" class="btn pequeno" data-x>Fechar</button></div>
        <input class="busca" type="search" placeholder="Buscar: supino, agachamento…" aria-label="Buscar exercício" style="min-height:44px;padding:0 14px;border-radius:14px;border:1px solid var(--campo-borda);background:var(--campo-fundo);font-size:15px">
        <div class="chips" data-filtros>${['Todos', ...Object.keys(grupos)].map((g, i) => `<button type="button" class="chip" data-grupo="${esc(g)}" aria-pressed="${i === 0}" style="min-height:34px;padding:6px 10px">${esc(g)}</button>`).join('')}</div>
        <div data-lista style="display:flex;flex-direction:column"></div>
        <button type="button" class="btn" data-novo>+ Criar exercício que não está na lista</button>
        <button type="button" class="btn primario" data-ok>Adicionar (0)</button>
      </div>`;
    document.body.appendChild(fundo);
    const lista = fundo.querySelector('[data-lista]');
    const busca = fundo.querySelector('.busca');
    const ok = fundo.querySelector('[data-ok]');
    let grupoAtual = 'Todos';
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    const desenhar = () => {
      const termo = norm(busca.value.trim());
      const itens = Object.entries(grupos)
        .filter(([g]) => grupoAtual === 'Todos' || g === grupoAtual)
        .flatMap(([g, l]) => l.map((n) => ({ nome: n, grupo: g === 'Meus exercícios' ? grupoDe[n] : g })))
        .filter((x) => !termo || norm(x.nome).includes(termo));
      lista.innerHTML = itens.slice(0, 120).map((x) => {
        const ja = jaNoTreino.includes(x.nome);
        return `<button type="button" class="item-check" data-ex="${esc(x.nome)}" aria-pressed="${marcados.has(x.nome)}" ${ja ? 'disabled style="opacity:.45"' : ''}>
          <span class="caixa" aria-hidden="true"></span>
          ${temExecucao(x.nome) ? `<span class="exec-btn" data-exec="${esc(x.nome)}">${execucao(x.nome, 'mini')}</span>` : ''}
          <span style="display:flex;flex-direction:column;gap:2px"><span class="t" style="font-size:14px;font-weight:600">${esc(x.nome)}</span><span class="mini">${esc(x.grupo)}${ja ? ' · já está no treino' : ''}</span></span>
        </button>`;
      }).join('') || '<p class="vazio">Nada encontrado. Crie o exercício abaixo.</p>';
      lista.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => {
        const n = b.dataset.ex;
        if (marcados.has(n)) marcados.delete(n); else marcados.add(n);
        b.setAttribute('aria-pressed', String(marcados.has(n)));
        ok.textContent = `Adicionar (${marcados.size})`;
      }));
      lista.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); verExecucao(b.dataset.exec); }));
    };
    const fechar = (v) => { fundo.remove(); resolve(v); };
    busca.addEventListener('input', desenhar);
    fundo.querySelectorAll('[data-grupo]').forEach((b) => b.addEventListener('click', () => {
      grupoAtual = b.dataset.grupo;
      fundo.querySelectorAll('[data-grupo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      desenhar();
    }));
    fundo.querySelector('[data-x]').addEventListener('click', () => fechar(null));
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(null); });
    ok.addEventListener('click', () => fechar([...marcados].map((n) => ({ nome: n, grupo: grupoDe[n] || 'Outros' }))));
    fundo.querySelector('[data-novo]').addEventListener('click', async () => {
      const nome = (busca.value.trim() || prompt('Nome do exercício') || '').trim();
      if (!nome) return busca.focus();
      const grupo = grupoAtual !== 'Todos' && grupoAtual !== 'Meus exercícios' ? grupoAtual : 'Outros';
      try {
        await q(db.from('exercicios_custom').upsert({ nome, grupo }, { onConflict: 'user_id,nome', ignoreDuplicates: true }));
      } catch (e) { return aviso(e.message); }
      grupoDe[nome] = grupo;
      grupos['Meus exercícios'] = [...new Set([...(grupos['Meus exercícios'] || []), nome])];
      marcados.add(nome);
      ok.textContent = `Adicionar (${marcados.size})`;
      busca.value = '';
      desenhar();
    });
    desenhar();
  });
}

// ================= Treinar agora =================
let timerDescanso = null;

async function modoTreinar(tela, sessaoId) {
  const [[sessao]] = await Promise.all([q(db.from('treino_sessoes').select('id,treino_id,nome,inicio,fim').eq('id', sessaoId))]);
  if (!sessao) return ir('#/treino');
  const [exs, feitas] = await Promise.all([
    sessao.treino_id
      ? q(db.from('treino_exercicios').select('id,nome,grupo,series,reps_min,reps_max,descanso_seg,notas').eq('treino_id', sessao.treino_id).order('ordem').order('criado_em'))
      : Promise.resolve([]),
    q(db.from('treino_series').select('id,exercicio,serie_n,carga,reps').eq('sessao_id', sessaoId))
  ]);
  // Última vez de cada exercício (outra sessão), para pré-preencher carga e reps
  const nomes = exs.map((e) => e.nome);
  const anteriores = nomes.length
    ? await q(db.from('treino_series').select('exercicio,serie_n,carga,reps,sessao_id,feito_em').in('exercicio', nomes).neq('sessao_id', sessaoId).order('feito_em', { ascending: false }).limit(600))
    : [];
  const ultima = {};
  for (const s of anteriores) {
    const u = ultima[s.exercicio] || (ultima[s.exercicio] = { sessao: s.sessao_id, data: s.feito_em, series: {} });
    if (u.sessao === s.sessao_id && !u.series[s.serie_n]) u.series[s.serie_n] = s;
  }

  // Estado: por exercício, lista de séries { carga, reps, id? }
  const estado = exs.map((e) => {
    const u = ultima[e.nome];
    const qtd = Math.max(e.series, ...feitas.filter((f) => f.exercicio === e.nome).map((f) => f.serie_n));
    return {
      ex: e,
      ultima: u,
      series: Array.from({ length: qtd }, (_, i) => {
        const n = i + 1;
        const feita = feitas.find((f) => f.exercicio === e.nome && f.serie_n === n);
        const ant = u?.series[n] || u?.series[Object.keys(u?.series || {}).pop()];
        return feita
          ? { n, carga: feita.carga, reps: feita.reps, id: feita.id }
          : { n, carga: ant?.carga ?? null, reps: ant?.reps ?? e.reps_max ?? e.reps_min ?? 10, id: null };
      })
    };
  });

  const desenhar = () => {
    const total = estado.reduce((t, x) => t + x.series.length, 0);
    const feitasN = estado.reduce((t, x) => t + x.series.filter((s) => s.id).length, 0);
    const volume = estado.reduce((t, x) => t + x.series.filter((s) => s.id).reduce((v, s) => v + Number(s.carga || 0) * Number(s.reps || 0), 0), 0);
    tela.innerHTML = `
      <header style="display:flex;flex-direction:column;gap:6px">
        <div class="cabeca" style="align-items:center"><a href="#/treino" class="btn pequeno">← Sair</a><span class="mini" id="relogio"></span></div>
        <h1 style="font-size:22px">${esc(sessao.nome)}</h1>
        <span class="barra" style="height:8px"><span style="width:${total ? Math.round((feitasN / total) * 100) : 0}%"></span></span>
        <span class="mini">${feitasN} de ${total} séries · volume ${Math.round(volume).toLocaleString('pt-BR')} kg</span>
      </header>
      ${estado.map((x, ei) => `
        <section class="card" style="display:flex;flex-direction:column;gap:10px;padding:14px">
          ${temExecucao(x.ex.nome) ? `<button type="button" class="exec-btn largo" data-exec="${esc(x.ex.nome)}" aria-label="Ampliar execução de ${esc(x.ex.nome)}">${execucao(x.ex.nome, 'media')}</button>` : ''}
          <div class="cabeca" style="align-items:flex-start">
            <span><span style="font-weight:800;font-size:15px">${esc(x.ex.nome)}</span><br>
            <span class="mini">${esc(x.ex.grupo || '')}${x.ex.reps_min || x.ex.reps_max ? ' · alvo ' + [x.ex.reps_min, x.ex.reps_max].filter(Boolean).join('–') + ' reps' : ''} · descanso ${x.ex.descanso_seg}s</span><br>
            <span class="mini">${x.ultima ? 'Última vez (' + dataCurta(x.ultima.data.slice(0, 10)) + '): ' + Object.values(x.ultima.series).sort((a, b) => a.serie_n - b.serie_n).map((s) => `${kg(s.carga).replace(' kg', '')}×${s.reps}`).join(' · ') : 'Primeira vez neste exercício'}</span></span>
            <a class="btn-editar" href="#/treino?exercicio=${encodeURIComponent(x.ex.nome)}" aria-label="Evolução de ${esc(x.ex.nome)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 15l4-4 3 3 5-6"/></svg></a>
          </div>
          <div class="series">
            <div class="serie cab"><span>Série</span><span>Carga (kg)</span><span>Reps</span><span></span></div>
            ${x.series.map((s, si) => `
              <div class="serie ${s.id ? 'feita' : ''}">
                <span class="n">${s.n}</span>
                <span class="passo"><button type="button" data-mais="${ei}:${si}:carga:-2.5" aria-label="Menos carga">−</button><input inputmode="decimal" data-valor="${ei}:${si}:carga" value="${s.carga == null ? '' : String(s.carga).replace('.', ',')}" placeholder="0" aria-label="Carga da série ${s.n}"><button type="button" data-mais="${ei}:${si}:carga:2.5" aria-label="Mais carga">+</button></span>
                <span class="passo"><button type="button" data-mais="${ei}:${si}:reps:-1" aria-label="Menos repetições">−</button><input inputmode="numeric" data-valor="${ei}:${si}:reps" value="${s.reps ?? ''}" placeholder="0" aria-label="Repetições da série ${s.n}"><button type="button" data-mais="${ei}:${si}:reps:1" aria-label="Mais repetições">+</button></span>
                <button type="button" class="check" data-feita="${ei}:${si}" aria-pressed="${!!s.id}" aria-label="Série ${s.n} feita">✓</button>
              </div>`).join('')}
          </div>
          <button type="button" class="btn pequeno" data-addserie="${ei}">+ Série</button>
        </section>`).join('') || '<p class="mini">Este treino não tem exercícios. Volte e edite o treino.</p>'}
      <button type="button" class="btn primario" id="finalizar" style="min-height:54px">Finalizar treino</button>`;

    ligarExecucoes(tela);
    // relógio do treino
    const rel = tela.querySelector('#relogio');
    const tick = () => { const m = Math.floor((Date.now() - new Date(sessao.inicio)) / 60000); rel.textContent = `${m} min de treino`; };
    tick();
    clearInterval(tela._relogio); tela._relogio = setInterval(() => { if (!document.body.contains(rel)) return clearInterval(tela._relogio); tick(); }, 30000);

    tela.querySelectorAll('[data-mais]').forEach((b) => b.addEventListener('click', () => {
      const [ei, si, campo, passo] = b.dataset.mais.split(':');
      const s = estado[ei].series[si];
      const novo = Math.max(0, num(s[campo]) + Number(passo));
      s[campo] = campo === 'reps' ? Math.round(novo) : Math.round(novo * 100) / 100;
      tela.querySelector(`[data-valor="${ei}:${si}:${campo}"]`).value = String(s[campo]).replace('.', ',');
      if (s.id) salvarSerie(estado[ei], s);
    }));
    tela.querySelectorAll('[data-valor]').forEach((inp) => inp.addEventListener('change', () => {
      const [ei, si, campo] = inp.dataset.valor.split(':');
      const s = estado[ei].series[si];
      s[campo] = inp.value.trim() === '' ? null : (campo === 'reps' ? Math.round(num(inp.value)) : num(inp.value));
      if (s.id) salvarSerie(estado[ei], s);
    }));
    tela.querySelectorAll('[data-feita]').forEach((b) => b.addEventListener('click', async () => {
      const [ei, si] = b.dataset.feita.split(':').map(Number);
      const x = estado[ei]; const s = x.series[si];
      b.disabled = true;
      try {
        if (s.id) {
          await q(db.from('treino_series').delete().eq('id', s.id));
          s.id = null;
        } else {
          const [r] = await q(db.from('treino_series').insert({ sessao_id: sessaoId, exercicio: x.ex.nome, grupo: x.ex.grupo, serie_n: s.n, carga: s.carga, reps: s.reps }).select('id'));
          s.id = r.id;
          // próxima série herda o que foi feito, se ainda estiver vazia
          const prox = x.series[si + 1];
          if (prox && !prox.id && prox.carga == null) prox.carga = s.carga;
          iniciarDescanso(x.ex.descanso_seg, x.ex.nome);
        }
      } catch (e) { aviso(e.message); }
      desenhar();
    }));
    tela.querySelectorAll('[data-addserie]').forEach((b) => b.addEventListener('click', () => {
      const x = estado[b.dataset.addserie];
      const ult = x.series[x.series.length - 1];
      x.series.push({ n: x.series.length + 1, carga: ult?.carga ?? null, reps: ult?.reps ?? 10, id: null });
      desenhar();
    }));
    tela.querySelector('#finalizar').addEventListener('click', async () => {
      const feitasAgora = estado.reduce((t, x) => t + x.series.filter((s) => s.id).length, 0);
      const v = await folha(`
        <h2>Finalizar treino</h2>
        <p class="mini" style="margin:0">${feitasAgora} séries · ${Math.round(volume).toLocaleString('pt-BR')} kg de volume · ${Math.round((Date.now() - new Date(sessao.inicio)) / 60000)} min</p>
        <form class="form">
          <div class="campo"><label for="f-esf">Esforço (1 leve a 10 máximo)</label><input id="f-esf" name="esforco" type="number" min="1" max="10"></div>
          <div class="campo"><label for="f-notas">Como foi?</label><input id="f-notas" name="notas" placeholder="opcional"></div>
          <div class="grade-2"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn primario">Finalizar</button></div>
        </form>`);
      if (!v) return;
      const fim = new Date();
      await q(db.from('treino_sessoes').update({
        fim: fim.toISOString(), duracao_min: Math.max(1, Math.round((fim - new Date(sessao.inicio)) / 60000)),
        esforco: v.esforco ? Math.round(num(v.esforco)) : null, notas: v.notas || null
      }).eq('id', sessaoId));
      if (!feitasAgora) await q(db.from('treino_sessoes').delete().eq('id', sessaoId)).catch(() => {});
      pararDescanso();
      aviso(feitasAgora ? 'Treino salvo 💪' : 'Treino descartado (nenhuma série feita)');
      ir('#/treino');
    });
  };

  const salvarSerie = async (x, s) => {
    await q(db.from('treino_series').update({ carga: s.carga, reps: s.reps }).eq('id', s.id)).catch((e) => aviso(e.message));
  };
  desenhar();
}

// Cronômetro de descanso: barra fixa embaixo; ao terminar vibra, apita e notifica (chega no relógio)
function iniciarDescanso(seg, exercicio) {
  pararDescanso();
  const fim = Date.now() + seg * 1000;
  const atualizar = () => {
    if (!document.querySelector('.series')) return pararDescanso(); // saiu da tela de treino
    let box = document.getElementById('descanso');
    if (!box) { box = document.createElement('div'); box.id = 'descanso'; box.className = 'descanso'; box.setAttribute('role', 'timer'); document.body.appendChild(box); }
    const r = Math.max(0, Math.round((fim - Date.now()) / 1000));
    box.hidden = false;
    box.innerHTML = `<span>Descanso <b>${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}</b></span>
      <span style="display:flex;gap:6px"><button type="button" data-d="-15">−15</button><button type="button" data-d="15">+15</button><button type="button" data-d="pular">Pular</button></span>`;
    box.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
      if (b.dataset.d === 'pular') return pararDescanso();
      iniciarDescanso(Math.max(5, r + Number(b.dataset.d)), exercicio);
    });
    if (r <= 0) { alertaFimDescanso(exercicio); pararDescanso(); }
  };
  atualizar();
  timerDescanso = setInterval(atualizar, 1000);
}

function pararDescanso() {
  clearInterval(timerDescanso); timerDescanso = null;
  document.getElementById('descanso')?.remove();
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
  // Notificação (aparece no relógio): útil quando a tela está apagada
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification('⏱️ Descanso acabou', {
      body: `Próxima série · ${exercicio}`, tag: 'descanso', renotify: true, vibrate: [300, 120, 300], icon: '/icons/icon-192.png', data: { link: location.hash ? '/' + location.hash : '/#/treino' }
    })).catch(() => {});
  }
}

// ================= Evolução de um exercício =================
async function historicoExercicio(tela, nome) {
  const series = await q(db.from('treino_series').select('sessao_id,serie_n,carga,reps,feito_em').eq('exercicio', nome).order('feito_em', { ascending: false }).limit(400));
  const porSessao = new Map();
  for (const s of series) {
    const k = s.sessao_id;
    if (!porSessao.has(k)) porSessao.set(k, { data: s.feito_em, series: [] });
    porSessao.get(k).series.push(s);
  }
  const sessoes = [...porSessao.values()].map((x) => {
    x.series.sort((a, b) => a.serie_n - b.serie_n);
    x.melhor = x.series.reduce((m, s) => (umRM(s.carga, s.reps) > umRM(m?.carga, m?.reps) ? s : m), null);
    x.rm = umRM(x.melhor?.carga, x.melhor?.reps);
    x.cargaMax = Math.max(...x.series.map((s) => Number(s.carga || 0)));
    x.volume = x.series.reduce((v, s) => v + Number(s.carga || 0) * Number(s.reps || 0), 0);
    return x;
  });
  const recorde = sessoes.reduce((m, x) => Math.max(m, x.cargaMax), 0);
  const rmMax = sessoes.reduce((m, x) => Math.max(m, x.rm), 0);
  const graf = [...sessoes].reverse().slice(-12);

  // Gráfico simples da força estimada (1RM) por treino
  let svg = '';
  if (graf.length >= 2) {
    const W = 300, H = 110, P = 10;
    const vals = graf.map((x) => x.rm);
    const min = Math.min(...vals), max = Math.max(...vals), amp = max - min || 1;
    const pts = vals.map((v, i) => [P + (i * (W - 2 * P)) / (vals.length - 1), H - P - ((v - min) / amp) * (H - 2 * P)]);
    svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Força estimada nos últimos ${vals.length} treinos, de ${Math.round(vals[0])} a ${Math.round(vals[vals.length - 1])} kg" style="width:100%;height:auto">
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--verde)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--verde)"/>`).join('')}
    </svg>`;
  }

  tela.innerHTML = `
    <header style="display:flex;flex-direction:column;gap:6px">
      <a href="javascript:history.back()" class="btn pequeno" style="align-self:flex-start">← Voltar</a>
      <h1 style="font-size:22px">${esc(nome)}</h1>
    </header>
    ${execucao(nome, 'grande')}
    <section class="grade-2">
      <div class="kpi"><span class="mini" style="font-weight:600">Maior carga</span><span class="n">${recorde ? kg(recorde) : '—'}</span></div>
      <div class="kpi"><span class="mini" style="font-weight:600">Força estimada (1RM)</span><span class="n">${rmMax ? kg(Math.round(rmMax)) : '—'}</span></div>
    </section>
    ${svg ? `<section class="card" style="display:flex;flex-direction:column;gap:6px"><span class="mini" style="font-weight:700">Evolução da força estimada</span>${svg}</section>` : ''}
    <section class="card lista">
      <h2 style="margin:10px 0 4px;font-size:15px">Treinos</h2>
      ${sessoes.map((x) => `
        <div class="linha"><span class="col"><span class="t">${dataCurta(x.data.slice(0, 10))}</span>
        <span class="mini">${x.series.map((s) => `${kg(s.carga).replace(' kg', '')}×${s.reps}`).join(' · ')}</span></span>
        <span class="v" style="font-size:13px">${x.cargaMax === recorde && recorde ? '🏆 ' : ''}${kg(x.cargaMax)}</span></div>`).join('') || '<p class="vazio">Ainda sem séries registradas.</p>'}
    </section>
    <p class="mini" style="margin:0">Força estimada pela fórmula de Epley (carga × (1 + reps/30)), a partir da melhor série de cada treino.</p>`;
}

import { db, q } from '../db.js';
import { esc, reais, reaisCurto, hojeISO, inicioMesISO, quando, dataLonga, saudacao, aviso, folha } from '../util.js';

export default async function hoje(tela, { sessao }) {
  const hj = hojeISO();
  const em5 = hojeISO(5), em30 = hojeISO(30);

  const [contas, docs, consultas, lancs, tarefas, habitos, regs, alertasDb, bancos] = await Promise.all([
    q(db.from('contas_pagar').select('id,nome,valor,vencimento,sala').is('pago_em', null).lte('vencimento', em5).order('vencimento')),
    q(db.from('documentos').select('id,nome,validade').not('validade', 'is', null).lte('validade', em30).order('validade')),
    q(db.from('consultas').select('id,titulo,tipo,data_hora,status,local').in('status', ['pendente', 'agendada']).order('data_hora', { nullsFirst: true })),
    q(db.from('lancamentos').select('tipo,valor').gte('data', inicioMesISO())),
    q(db.from('tarefas').select('id,titulo,sala,data,hora,concluida_em').or(`data.is.null,data.lte.${hj}`).order('hora', { nullsFirst: false }).order('criado_em').limit(30)),
    q(db.from('habitos').select('id,nome,horario').eq('ativo', true).order('horario', { nullsFirst: false }).order('ordem').order('criado_em')),
    q(db.from('habito_registros').select('habito_id').eq('data', hj)),
    q(db.from('alertas').select('id,titulo,detalhe,sala,nivel,link').is('lido_em', null).order('criado_em', { ascending: false }).limit(5)),
    q(db.from('banco_conexoes').select('saldo,saldo_em')).catch(() => [])
  ]);

  // ---- Alertas: o que a Arca avisa ----
  const alertas = [
    ...alertasDb.map((a) => ({ ...a, link: a.link || '#/hoje' })),
    ...contas.map((c) => ({ titulo: `${c.nome} ${quando(c.vencimento).startsWith('venceu') ? quando(c.vencimento) : 'vence ' + quando(c.vencimento)}`, detalhe: `Contas${c.valor ? ' · ' + reais(c.valor) : ''}`, nivel: 'atencao', link: '#/financas' })),
    ...docs.map((d) => ({ titulo: `${d.nome} ${quando(d.validade).startsWith('venceu') ? quando(d.validade) : 'vence ' + quando(d.validade)}`, detalhe: 'Documentos', nivel: 'atencao', link: '#/documentos' })),
    ...consultas.filter((c) => c.status === 'pendente').map((c) => ({ titulo: `${c.titulo} ainda sem data`, detalhe: 'Saúde', nivel: 'info', link: '#/salas' }))
  ];

  const entrou = lancs.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  const saiu = lancs.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0);
  // Saldo real da conta corrente (vindo do banco); investimentos não entram
  const comSaldo = (bancos || []).filter((b) => b.saldo != null);
  const saldoConta = comSaldo.reduce((t, b) => t + Number(b.saldo), 0);
  const ultimoSaldo = comSaldo.map((b) => b.saldo_em).filter(Boolean).sort().pop();
  const saldoEm = ultimoSaldo ? new Date(ultimoSaldo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
  const usado = entrou > 0 ? Math.min(100, Math.round((saiu / entrou) * 100)) : 0;

  const pendentes = tarefas.filter((t) => !t.concluida_em || t.concluida_em.slice(0, 10) === hj);
  const feitos = new Set(regs.map((r) => r.habito_id));
  const agendaHoje = consultas.filter((c) => c.data_hora && c.data_hora.slice(0, 10) === hj);
  const nome = (sessao.user?.name || '').split(' ')[0];

  tela.innerHTML = `
    <header>
      <p class="mini" style="font-weight:600">${esc(dataLonga())}</p>
      <h1 style="margin-top:4px">${saudacao()}${nome ? ', ' + esc(nome) : ''}</h1>
    </header>

    <a href="#/capturar" class="card" style="display:flex;align-items:center;gap:10px;padding:14px 16px;text-decoration:none;color:var(--suave)">
      <span style="flex:1">Registre ou pergunte qualquer coisa…</span>
      <span class="btn-icone" style="background:var(--verde-fundo);color:var(--verde);border:0" aria-hidden="true">+</span>
    </a>

    <section class="card" aria-labelledby="h-alertas" style="padding-bottom:4px">
      <h2 id="h-alertas" class="rotulo" style="margin-bottom:6px">A Arca avisa</h2>
      ${alertas.length ? alertas.slice(0, 6).map((a) => `
        <a class="alerta ${esc(a.nivel)}" href="${esc(a.link)}">
          <span class="ic" aria-hidden="true">!</span>
          <span class="col" style="display:flex;flex-direction:column;gap:2px;flex:1"><span class="t" style="font-size:14px;font-weight:700">${esc(a.titulo)}</span><span class="mini">${esc(a.detalhe || '')}</span></span>
        </a>`).join('') : `<p class="mini" style="padding:6px 0 12px;margin:0">Tudo em dia. Quando algo estiver para vencer, aparece aqui.</p>`}
    </section>

    <a href="#/financas" class="grade-2" style="text-decoration:none;color:inherit">
      ${comSaldo.length
        ? `<a class="kpi" href="#/financas" style="text-decoration:none;color:inherit"><span class="mini" style="font-weight:600">Saldo na conta</span><span class="n">${reais(saldoConta)}</span><span class="mini">conta corrente${saldoEm ? ' · ' + esc(saldoEm) : ''}</span></a>`
        : `<span class="kpi"><span class="mini" style="font-weight:600">Livre no mês</span><span class="n">${reaisCurto(entrou - saiu)}</span><span class="mini">${lancs.length ? lancs.length + ' lançamentos' : 'nenhum lançamento ainda'}</span></span>`}
      <span class="kpi"><span class="mini" style="font-weight:600">Orçamento usado</span><span class="n">${entrou ? usado + '%' : '—'}</span><span class="barra"><span style="width:${usado}%"></span></span></span>
    </a>

    ${agendaHoje.length ? `
    <section aria-labelledby="h-agenda" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="h-agenda">Agenda</h2>
      ${agendaHoje.map((c) => `<div class="card" style="display:flex;gap:14px;align-items:center;padding:12px 14px"><span class="ok" style="width:46px">${esc(new Date(c.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }))}</span><span><span style="font-weight:700;font-size:14px">${esc(c.titulo)}</span><br><span class="mini">${esc(c.local || 'Saúde')}</span></span></div>`).join('')}
    </section>` : ''}

    <section class="card lista" aria-labelledby="h-tarefas">
      <div class="cabeca" style="margin:10px 0 4px"><h2 id="h-tarefas" style="font-size:17px">Tarefas de hoje</h2><button type="button" class="btn pequeno suave" id="nova-tarefa">+ Tarefa</button></div>
      ${pendentes.length ? pendentes.map((t) => `
        <button type="button" class="item-check" data-tarefa="${t.id}" aria-pressed="${!!t.concluida_em}">
          <span class="caixa" aria-hidden="true"></span>
          <span class="col" style="display:flex;flex-direction:column;gap:2px"><span class="t" style="font-size:15px;font-weight:600">${esc(t.titulo)}</span><span class="mini">${esc([t.hora?.slice(0, 5), t.sala, t.data && t.data < hj ? 'atrasada' : ''].filter(Boolean).join(' · '))}</span></span>
        </button>`).join('') : `<p class="vazio">Nada pendente. Diga “lembrar de levar o carro na revisão amanhã” na captura.</p>`}
    </section>

    <section class="card lista" aria-labelledby="h-rotina">
      <div class="cabeca" style="margin:10px 0 4px"><h2 id="h-rotina" style="font-size:17px">Rotina</h2><span style="display:flex;gap:8px;align-items:center"><span class="mini">${feitos.size} de ${habitos.length}</span><button type="button" class="btn pequeno suave" id="novo-habito">+ Rotina</button></span></div>
      ${habitos.length ? habitos.map((h) => `
        <div class="linha-rotina">
          <button type="button" class="item-check" data-habito="${h.id}" aria-pressed="${feitos.has(h.id)}">
            <span class="caixa" aria-hidden="true"></span>
            <span class="hora-rotina">${h.horario ? esc(h.horario.slice(0, 5)) : '—'}</span>
            <span class="t" style="font-size:15px;font-weight:600">${esc(h.nome)}</span>
          </button>
          <button type="button" class="btn-editar" data-editar-habito="${h.id}" aria-label="Editar ${esc(h.nome)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>
          </button>
        </div>`).join('') : `<p class="vazio">Monte sua rotina com horário: acordar 6:00, treinar 7:00, ler 22:00…</p>`}
    </section>
  `;

  // ---- Ações ----
  tela.querySelectorAll('[data-tarefa]').forEach((b) => b.addEventListener('click', async () => {
    const feito = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(feito));
    await q(db.from('tarefas').update({ concluida_em: feito ? new Date().toISOString() : null }).eq('id', b.dataset.tarefa)).catch((e) => aviso(e.message));
  }));

  tela.querySelectorAll('[data-habito]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.habito;
    const feito = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(feito));
    const op = feito
      ? db.from('habito_registros').insert({ habito_id: id, data: hj })
      : db.from('habito_registros').delete().eq('habito_id', id).eq('data', hj);
    await q(op).catch((e) => aviso(e.message));
  }));

  tela.querySelectorAll('[data-editar-habito]').forEach((b) => b.addEventListener('click', async () => {
    const h = habitos.find((x) => x.id === b.dataset.editarHabito);
    const v = await folha(formRotina('Editar item da rotina', h, true));
    if (!v) return;
    try {
      if (v.remover) await q(db.from('habitos').update({ ativo: false }).eq('id', h.id));
      else await q(db.from('habitos').update({ nome: v.nome, horario: v.horario || null }).eq('id', h.id));
    } catch (e) {
      return aviso('Não consegui salvar: ' + e.message);
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));

  tela.querySelector('#nova-tarefa').addEventListener('click', async () => {
    const v = await folha(`
      <h2>Nova tarefa</h2>
      <form class="form">
        <div class="campo"><label for="t-titulo">O que fazer</label><input id="t-titulo" name="titulo" required></div>
        <div class="grade-2">
          <div class="campo"><label for="t-data">Dia</label><input id="t-data" name="data" type="date" value="${hj}"></div>
          <div class="campo"><label for="t-hora">Hora</label><input id="t-hora" name="hora" type="time"></div>
        </div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    if (!v) return;
    await q(db.from('tarefas').insert({ titulo: v.titulo, data: v.data || null, hora: v.hora || null }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  tela.querySelector('#novo-habito').addEventListener('click', async () => {
    const v = await folha(formRotina('Novo item da rotina'));
    if (!v) return;
    try {
      await q(db.from('habitos').insert({ nome: v.nome, horario: v.horario || null }));
    } catch (e) {
      return aviso('Não consegui salvar: ' + e.message);
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function formRotina(titulo, h = {}, editar = false) {
  return `
    <h2>${titulo}</h2>
    <form class="form">
      <div class="campo"><label for="r-nome">O que</label><input id="r-nome" name="nome" value="${esc(h.nome || '')}" placeholder="Ex.: Treinar" required></div>
      <div class="campo"><label for="r-hora">Horário</label><input id="r-hora" name="horario" type="time" value="${esc(h.horario?.slice(0, 5) || '')}"></div>
      ${editar ? '<label class="mini" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="remover" value="1"> Tirar da rotina</label>' : ''}
      <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">${editar ? 'Salvar' : 'Criar'}</button></div>
    </form>`;
}

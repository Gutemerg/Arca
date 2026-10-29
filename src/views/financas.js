import { db, q, tokenAtual } from '../db.js';
import { esc, reais, reaisCurto, hojeISO, inicioMesISO, quando, dataCurta, aviso, folha, CORES } from '../util.js';

const recarregar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export default async function financas(tela) {
  const [lancs, contas, assin, caixas, cats, bancos] = await Promise.all([
    q(db.from('lancamentos').select('id,tipo,valor,descricao,data,origem,conta,categorias(nome)').gte('data', inicioMesISO()).order('data', { ascending: false }).order('criado_em', { ascending: false })),
    q(db.from('contas_pagar').select('id,nome,valor,vencimento,recorrencia,debito_automatico').is('pago_em', null).order('vencimento').limit(8)),
    q(db.from('assinaturas').select('id,nome,valor,ciclo,ultimo_uso').eq('ativa', true).order('valor', { ascending: false })),
    q(db.from('caixinhas').select('id,nome,meta,saldo').order('criado_em')),
    q(db.from('categorias').select('nome,tipo').order('nome')),
    q(db.from('banco_conexoes').select('id,item_id,apelido,ultima_sync,ultimo_erro,saldo,saldo_em,ultimo_resumo').order('criado_em'))
  ]);

  const entrou = soma(lancs.filter((l) => l.tipo === 'entrada'));
  const saiu = soma(lancs.filter((l) => l.tipo === 'saida'));

  // Agrupa gastos por categoria para a pizza
  const porCat = {};
  lancs.filter((l) => l.tipo === 'saida').forEach((l) => {
    const c = l.categorias?.nome || 'Outros';
    porCat[c] = (porCat[c] || 0) + Number(l.valor);
  });
  let fatias = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (fatias.length > 7) fatias = [...fatias.slice(0, 6), ['Outros', fatias.slice(6).reduce((s, [, v]) => s + v, 0)]];
  let acc = 0;
  const gradiente = fatias.map(([, v], i) => {
    const de = acc; acc += (v / saiu) * 100;
    return `${CORES[i % CORES.length]} ${de.toFixed(2)}% ${acc.toFixed(2)}%`;
  }).join(', ');
  const totalAssin = assin.reduce((s, a) => s + Number(a.valor) / (a.ciclo === 'anual' ? 12 : 1), 0);
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());

  tela.innerHTML = `
    <header class="cabeca" style="align-items:center"><h1>Finanças</h1><button type="button" class="btn pequeno suave" id="novo-lanc">+ Lançamento</button></header>

    <section class="card" aria-label="Resumo do mês" style="display:flex;flex-direction:column;gap:12px">
      <span class="mini" style="font-weight:700">Livre em ${esc(mes)}</span>
      <span style="font-size:34px;font-weight:800;letter-spacing:-0.03em">${reais(entrou - saiu)}</span>
      <div class="grade-2" style="gap:10px">
        <div style="background:var(--card-2);border-radius:12px;padding:10px 12px"><span class="mini" style="display:block;font-weight:700">Entrou</span><span class="ok" style="font-size:16px;font-weight:800">${reaisCurto(entrou)}</span></div>
        <div style="background:var(--card-2);border-radius:12px;padding:10px 12px"><span class="mini" style="display:block;font-weight:700">Saiu</span><span style="font-size:16px;font-weight:800">${reaisCurto(saiu)}</span></div>
      </div>
    </section>

    ${cartaoBanco(bancos)}

    <section class="card" aria-labelledby="h-pizza" style="display:flex;flex-direction:column;gap:14px">
      <div class="cabeca"><h2 id="h-pizza">Para onde foi</h2><span class="mini">${esc(mes)}</span></div>
      ${saiu > 0 ? `
      <div class="pizza-wrap">
        <div class="pizza" role="img" aria-label="Gastos por categoria: ${esc(fatias.map(([n, v]) => `${n} ${Math.round((v / saiu) * 100)}%`).join(', '))}" style="background:conic-gradient(${gradiente})">
          <div class="centro"><span class="mini" style="font-weight:700">Total</span><span style="font-size:15px;font-weight:800">${reaisCurto(saiu)}</span></div>
        </div>
        <div class="legenda">
          ${fatias.map(([n, v], i) => `<div><i style="background:${CORES[i % CORES.length]}"></i><span>${esc(n)}</span><span style="font-weight:800">${Math.round((v / saiu) * 100)}%</span></div>`).join('')}
        </div>
      </div>` : `<p class="vazio" style="border:0;padding:0">Seus gastos do mês aparecem aqui. Diga “paguei 45 no mercado” na captura.</p>`}
    </section>

    <section class="card lista" aria-labelledby="h-contas">
      <div class="cabeca" style="margin:10px 0 4px"><h2 id="h-contas" style="font-size:15px">Próximas contas</h2><button type="button" class="btn pequeno" id="nova-conta">+ Conta</button></div>
      ${contas.length ? contas.map((c) => {
        const n = Math.round((new Date(c.vencimento) - new Date(hojeISO())) / 86400000);
        return `
        <div class="linha">
          <span class="col"><span class="t">${esc(c.nome)}</span><span class="mini ${n <= 2 ? 'atencao' : ''}">${quando(c.vencimento).startsWith('venceu') ? quando(c.vencimento) : 'vence ' + quando(c.vencimento)}${c.debito_automatico ? ' · débito automático' : ''}</span></span>
          <span style="display:flex;align-items:center;gap:10px"><span class="v">${c.valor ? reais(c.valor) : ''}</span><button type="button" class="btn pequeno suave" data-pagar="${c.id}">Paguei</button></span>
        </div>`;
      }).join('') : '<p class="vazio">Nenhuma conta cadastrada. Ex.: “a internet vence todo dia 30, 119,90”.</p>'}
    </section>

    <section class="card lista" aria-labelledby="h-assin">
      <div class="cabeca" style="margin:10px 0 4px"><h2 id="h-assin" style="font-size:15px">Assinaturas</h2><span style="display:flex;gap:8px;align-items:center"><span class="mini" style="font-weight:700">${reais(totalAssin)}/mês</span><button type="button" class="btn pequeno" id="nova-assin" aria-label="Nova assinatura">+</button></span></div>
      ${assin.length ? assin.map((a) => {
        const parado = a.ultimo_uso && (Date.now() - new Date(a.ultimo_uso)) / 86400000 > 45;
        return `<div class="linha"><span class="col"><span class="t">${esc(a.nome)}</span>${parado ? '<span class="mini atencao">sem uso há mais de 45 dias</span>' : `<span class="mini">${a.ciclo}</span>`}</span><span class="v">${reais(a.valor)}</span></div>`;
      }).join('') : '<p class="vazio">Cadastre streaming, academia, nuvem… e veja quanto somam por mês.</p>'}
    </section>

    <section aria-labelledby="h-caixas" style="display:flex;flex-direction:column;gap:10px">
      <div class="cabeca"><h2 id="h-caixas">Caixinhas</h2><button type="button" class="btn pequeno" id="nova-caixa">+ Caixinha</button></div>
      ${caixas.map((c) => {
        const p = c.meta ? Math.min(100, Math.round((c.saldo / c.meta) * 100)) : 0;
        return `<button type="button" class="card" data-caixa="${c.id}" style="display:flex;flex-direction:column;gap:8px;text-align:left;cursor:pointer;padding:14px">
          <span class="cabeca" style="width:100%;font-size:14px"><span style="font-weight:700">${esc(c.nome)}</span><span class="mini">${c.meta ? p + '%' : ''}</span></span>
          ${c.meta ? `<span class="barra" style="width:100%;height:8px"><span style="width:${p}%"></span></span>` : ''}
          <span class="mini">${reais(c.saldo)}${c.meta ? ' de ' + reais(c.meta) : ''} · toque para depositar</span>
        </button>`;
      }).join('') || '<p class="mini" style="margin:0">Separe dinheiro para metas: reserva, viagem, troca do carro…</p>'}
    </section>

    <section class="card lista" aria-labelledby="h-ult">
      <h2 id="h-ult">Lançamentos do mês</h2>
      ${lancs.slice(0, 15).map((l) => `
        <div class="linha"><span class="col"><span class="t">${esc(l.descricao)}</span><span class="mini">${dataCurta(l.data)} · ${esc(l.categorias?.nome || 'Sem categoria')}${l.origem === 'banco' ? ' · banco' : ''}</span></span>
        <span style="display:flex;align-items:center;gap:6px"><span class="v ${l.tipo === 'entrada' ? 'ok' : ''}">${l.tipo === 'entrada' ? '+' : '−'} ${reais(l.valor)}</span><button type="button" class="btn-icone" style="width:36px;height:36px;border:0;background:none;color:var(--suave)" data-apagar="${l.id}" aria-label="Apagar ${esc(l.descricao)}">×</button></span></div>`).join('') || '<p class="vazio">Nenhum lançamento neste mês.</p>'}
    </section>
    <datalist id="lista-cats">${cats.map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist>`;

  // ---- Ações ----
  ligarBanco(tela, bancos);

  tela.querySelector('#novo-lanc').addEventListener('click', async () => {
    const v = await folha(`
      <h2>Novo lançamento</h2>
      <form class="form">
        <div class="campo"><label for="l-tipo">Tipo</label><select id="l-tipo" name="tipo"><option value="saida">Saída (gasto)</option><option value="entrada">Entrada</option></select></div>
        <div class="campo"><label for="l-desc">Descrição</label><input id="l-desc" name="descricao" required></div>
        <div class="grade-2">
          <div class="campo"><label for="l-valor">Valor (R$)</label><input id="l-valor" name="valor" inputmode="decimal" required></div>
          <div class="campo"><label for="l-data">Data</label><input id="l-data" name="data" type="date" value="${hojeISO()}"></div>
        </div>
        <div class="campo"><label for="l-cat">Categoria</label><input id="l-cat" name="categoria" list="lista-cats" placeholder="Ex.: Mercado"></div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    if (!v) return;
    const categoria_id = v.categoria ? await categoria(v.categoria, v.tipo) : null;
    await q(db.from('lancamentos').insert({ tipo: v.tipo, descricao: v.descricao, valor: num(v.valor), data: v.data, categoria_id }));
    recarregar();
  });

  tela.querySelector('#nova-conta').addEventListener('click', async () => {
    const v = await folha(`
      <h2>Nova conta</h2>
      <form class="form">
        <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" name="nome" placeholder="Ex.: Internet" required></div>
        <div class="grade-2">
          <div class="campo"><label for="c-valor">Valor (R$)</label><input id="c-valor" name="valor" inputmode="decimal"></div>
          <div class="campo"><label for="c-venc">Vencimento</label><input id="c-venc" name="vencimento" type="date" required></div>
        </div>
        <div class="campo"><label for="c-rec">Repete</label><select id="c-rec" name="recorrencia"><option value="mensal">Todo mês</option><option value="anual">Todo ano</option><option value="unica">Só uma vez</option></select></div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    if (!v) return;
    await q(db.from('contas_pagar').insert({ nome: v.nome, valor: v.valor ? num(v.valor) : null, vencimento: v.vencimento, recorrencia: v.recorrencia }));
    recarregar();
  });

  tela.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
    const c = contas.find((x) => x.id === b.dataset.pagar);
    let valor = c.valor;
    if (!valor) {
      const v = await folha(`<h2>${esc(c.nome)}</h2><form class="form"><div class="campo"><label for="p-valor">Quanto foi? (R$)</label><input id="p-valor" name="valor" inputmode="decimal" required></div><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Confirmar</button></div></form>`);
      if (!v) return;
      valor = num(v.valor);
    }
    b.disabled = true;
    const cat = await categoria('Contas da casa', 'saida');
    const [l] = await q(db.from('lancamentos').insert({ tipo: 'saida', valor, descricao: c.nome, categoria_id: cat, data: hojeISO() }).select('id'));
    await q(db.from('contas_pagar').update({ pago_em: hojeISO(), lancamento_id: l.id, valor }).eq('id', c.id));
    // Conta recorrente: já cria a do próximo ciclo
    if (c.recorrencia !== 'unica') {
      const d = new Date(c.vencimento + 'T12:00:00');
      if (c.recorrencia === 'mensal') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1);
      await q(db.from('contas_pagar').insert({ nome: c.nome, valor: c.valor, vencimento: d.toISOString().slice(0, 10), recorrencia: c.recorrencia, debito_automatico: c.debito_automatico }));
    }
    aviso(`${c.nome} paga`);
    recarregar();
  }));

  tela.querySelector('#nova-assin').addEventListener('click', async () => {
    const v = await folha(`
      <h2>Nova assinatura</h2>
      <form class="form">
        <div class="campo"><label for="a-nome">Nome</label><input id="a-nome" name="nome" placeholder="Ex.: Streaming" required></div>
        <div class="grade-2">
          <div class="campo"><label for="a-valor">Valor (R$)</label><input id="a-valor" name="valor" inputmode="decimal" required></div>
          <div class="campo"><label for="a-ciclo">Cobrança</label><select id="a-ciclo" name="ciclo"><option value="mensal">Mensal</option><option value="anual">Anual</option></select></div>
        </div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    if (!v) return;
    await q(db.from('assinaturas').insert({ nome: v.nome, valor: num(v.valor), ciclo: v.ciclo, ultimo_uso: hojeISO() }));
    recarregar();
  });

  tela.querySelector('#nova-caixa').addEventListener('click', async () => {
    const v = await folha(`
      <h2>Nova caixinha</h2>
      <form class="form">
        <div class="campo"><label for="x-nome">Nome</label><input id="x-nome" name="nome" placeholder="Ex.: Reserva de emergência" required></div>
        <div class="grade-2">
          <div class="campo"><label for="x-meta">Meta (R$)</label><input id="x-meta" name="meta" inputmode="decimal"></div>
          <div class="campo"><label for="x-saldo">Já tenho (R$)</label><input id="x-saldo" name="saldo" inputmode="decimal" value="0"></div>
        </div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Criar</button></div>
      </form>`);
    if (!v) return;
    await q(db.from('caixinhas').insert({ nome: v.nome, meta: v.meta ? num(v.meta) : null, saldo: num(v.saldo || 0) }));
    recarregar();
  });

  tela.querySelectorAll('[data-caixa]').forEach((b) => b.addEventListener('click', async () => {
    const c = caixas.find((x) => x.id === b.dataset.caixa);
    const v = await folha(`<h2>${esc(c.nome)}</h2><form class="form"><div class="campo"><label for="d-valor">Depositar (use − para retirar)</label><input id="d-valor" name="valor" inputmode="decimal" required></div><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Confirmar</button></div></form>`);
    if (!v) return;
    await q(db.from('caixinhas').update({ saldo: Number(c.saldo) + num(v.valor) }).eq('id', c.id));
    recarregar();
  }));

  tela.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', async () => {
    const v = await folha(`<h2>Apagar lançamento?</h2><form class="form"><div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Apagar</button></div></form>`);
    if (!v) return;
    await q(db.from('contas_pagar').update({ pago_em: null, lancamento_id: null }).eq('lancamento_id', b.dataset.apagar));
    await q(db.from('lancamentos').delete().eq('id', b.dataset.apagar));
    recarregar();
  }));
}

const soma = (ls) => ls.reduce((s, l) => s + Number(l.valor), 0);
const num = (s) => Number(String(s).replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0;

async function categoria(nome, tipo) {
  const achou = await q(db.from('categorias').select('id').eq('tipo', tipo).ilike('nome', nome).limit(1));
  if (achou[0]) return achou[0].id;
  const [nova] = await q(db.from('categorias').insert({ nome, tipo }).select('id'));
  return nova.id;
}

// ============ Conta bancária (Open Finance via Meu Pluggy) ============
const HORAS_AUTO = 12;

function quandoSync(iso) {
  if (!iso) return 'ainda não sincronizou';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return 'em ' + dataCurta(new Date(iso).toISOString().slice(0, 10));
}

function cartaoBanco(bancos) {
  if (!bancos.length) return `
    <section class="card" aria-labelledby="h-banco" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="h-banco">Conta bancária</h2>
      <p class="mini" style="margin:0;line-height:1.5">Conecte sua conta corrente pelo Open Finance e os gastos entram aqui sozinhos, já separados por categoria.</p>
      <button type="button" class="btn suave" id="conectar-banco">Conectar conta</button>
    </section>`;
  return `
    <section class="card lista" aria-labelledby="h-banco">
      <div class="cabeca" style="margin:10px 0 4px"><h2 id="h-banco" style="font-size:15px">Conta bancária</h2><button type="button" class="btn pequeno suave" id="sync-banco">Sincronizar</button></div>
      ${bancos.map((b) => {
        const st = b.ultimo_resumo?.item?.status;
        const coletando = st && st !== 'UPDATED' && !b.ultimo_erro;
        return `
        <div class="linha">
          <span class="col"><span class="t">${esc(b.apelido || 'Conta corrente')}</span>
          <span class="mini ${b.ultimo_erro || coletando ? 'atencao' : ''}">${b.ultimo_erro ? 'erro: ' + esc(b.ultimo_erro) : coletando ? 'o banco ainda está sendo lido pela Pluggy' : 'atualizada ' + quandoSync(b.ultima_sync)}</span></span>
          <span style="display:flex;align-items:center;gap:10px">${b.saldo != null ? `<span class="v" title="Saldo no banco">${reais(b.saldo)}</span>` : ''}<button type="button" class="btn pequeno" data-banco="${b.id}">Trocar</button></span>
        </div>`;
      }).join('')}
      <div class="linha" style="min-height:44px"><button type="button" class="btn pequeno" id="conectar-banco">+ Outra conta</button></div>
    </section>`;
}

async function sincronizar(botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Sincronizando…'; }
  try {
    const token = await tokenAtual();
    const r = await fetch('/api/banco-sync', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(res.erro || (res.erros || []).join(' ') || 'Não consegui sincronizar');
    if (res.avisos?.length) aviso(res.avisos[0]);
    else if (botao || res.novos) aviso(res.novos ? `${res.novos} lançamento(s) novo(s) do banco` : res.lidos ? 'Tudo em dia com o banco' : 'O banco não enviou movimentações neste período');
    recarregar();
  } catch (e) {
    if (botao) aviso(e.message);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = 'Sincronizar'; }
  }
}

let autoFeito = false;

function ligarBanco(tela, bancos) {
  tela.querySelector('#sync-banco')?.addEventListener('click', (e) => sincronizar(e.currentTarget));

  tela.querySelector('#conectar-banco')?.addEventListener('click', async () => {
    const v = await folha(`
      <h2>Conectar conta corrente</h2>
      <ol class="mini" style="margin:0;padding-left:18px;line-height:1.6">
        <li>Em <a href="https://meu.pluggy.ai" target="_blank" rel="noopener">meu.pluggy.ai</a>, conecte seu banco pelo Open Finance.</li>
        <li>No painel da Pluggy, abra a sua aplicação → <b>Ir para Demo</b>, autorize o Meu Pluggy e use <b>Copiar Item ID</b>.</li>
        <li>Cole o Item ID abaixo.</li>
      </ol>
      <form class="form">
        <div class="campo"><label for="b-item">Item ID</label><input id="b-item" name="item_id" required autocomplete="off" spellcheck="false"></div>
        <div class="campo"><label for="b-nome">Apelido</label><input id="b-nome" name="apelido" placeholder="Ex.: Nubank"></div>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Conectar</button></div>
      </form>`);
    if (!v) return;
    await q(db.from('banco_conexoes').insert({ item_id: v.item_id.trim(), apelido: v.apelido?.trim() || null }));
    aviso('Conta conectada. Buscando os últimos 90 dias…');
    await sincronizar(null);
    recarregar();
  });

  tela.querySelectorAll('[data-banco]').forEach((botao) => botao.addEventListener('click', async () => {
    const b = bancos.find((x) => x.id === botao.dataset.banco);
    const v = await folha(`
      <h2>Trocar conta bancária</h2>
      <p class="mini" style="margin:0;line-height:1.5">Para trocar de banco, conecte o novo em <a href="https://meu.pluggy.ai" target="_blank" rel="noopener">meu.pluggy.ai</a>, copie o novo Item ID no painel da Pluggy (Ir para Demo → Copiar Item ID) e cole aqui. Os lançamentos já importados continuam na Arca.</p>
      <form class="form">
        <div class="campo"><label for="t-item">Item ID</label><input id="t-item" name="item_id" value="${esc(b.item_id)}" required autocomplete="off" spellcheck="false"></div>
        <div class="campo"><label for="t-nome">Apelido</label><input id="t-nome" name="apelido" value="${esc(b.apelido || '')}" placeholder="Ex.: Nubank"></div>
        <label class="mini" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="remover" value="1"> Desconectar esta conta (para de sincronizar)</label>
        <div class="grade-2"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn primario">Salvar</button></div>
      </form>`);
    if (!v) return;
    if (v.remover) {
      await q(db.from('banco_conexoes').delete().eq('id', b.id));
      aviso('Conta desconectada. Os lançamentos já importados foram mantidos.');
      return recarregar();
    }
    const novoItem = v.item_id.trim();
    const mudou = novoItem !== b.item_id;
    // Ao trocar o Item ID, recomeça de onde parou (os repetidos são descartados na sincronização)
    await q(db.from('banco_conexoes').update({ item_id: novoItem, apelido: v.apelido?.trim() || null, ultimo_erro: null }).eq('id', b.id));
    if (mudou) { aviso('Conta trocada. Sincronizando…'); await sincronizar(null); }
    recarregar();
  }));

  // Sincroniza sozinho ao abrir Finanças, no máximo a cada 12 horas
  const velha = bancos.some((b) => !b.ultima_sync || Date.now() - new Date(b.ultima_sync) > HORAS_AUTO * 3600000);
  if (bancos.length && velha && !autoFeito) {
    autoFeito = true;
    sincronizar(null);
  }
}

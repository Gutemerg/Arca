import { db, q } from '../db.js';
import { esc, quando, dataCurta, diasAte, folha } from '../util.js';

const PASTAS = { identidade: 'Identidade', veiculo: 'Veículo', casa: 'Casa', saude: 'Saúde', contratos: 'Contratos', garantias: 'Garantias', outros: 'Outros' };
const recarregar = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export default async function documentos(tela, { params }) {
  const filtro = params.get('pasta');
  const docs = await q(db.from('documentos').select('id,nome,pasta,validade,notas').order('validade', { nullsFirst: false }).order('nome'));
  const vencendo = docs.filter((d) => d.validade && diasAte(d.validade) <= 30);
  const lista = filtro ? docs.filter((d) => d.pasta === filtro) : docs;
  const contagem = Object.fromEntries(Object.keys(PASTAS).map((p) => [p, docs.filter((d) => d.pasta === p).length]));

  tela.innerHTML = `
    <header class="cabeca" style="align-items:center">
      <div><h1>Documentos</h1><p class="sub">${docs.length} guardados${vencendo.length ? ` · ${vencendo.length} vencendo` : ''}</p></div>
      <button type="button" class="btn pequeno suave" id="novo-doc">+ Documento</button>
    </header>

    ${vencendo.map((d) => `
      <div class="card" style="display:flex;gap:12px;align-items:center;background:#241F14;border-color:#4A3B17">
        <span class="atencao" aria-hidden="true" style="font-size:18px">!</span>
        <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:800">${esc(d.nome)} ${quando(d.validade).startsWith('venceu') ? quando(d.validade) : 'vence ' + quando(d.validade)}</span><span class="mini" style="color:#D8C9A4">${esc(PASTAS[d.pasta] || d.pasta)} · ${dataCurta(d.validade)}</span></span>
      </div>`).join('')}

    <section aria-labelledby="h-pastas" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="h-pastas">Pastas</h2>
      <div class="chips">
        <a class="chip" href="#/documentos" aria-pressed="${!filtro}" style="text-decoration:none;color:inherit">Todas · ${docs.length}</a>
        ${Object.entries(PASTAS).map(([k, n]) => `<a class="chip" href="#/documentos?pasta=${k}" aria-pressed="${filtro === k}" style="text-decoration:none;color:inherit">${n} · ${contagem[k]}</a>`).join('')}
      </div>
    </section>

    <section class="card lista" aria-labelledby="h-lista">
      <h2 id="h-lista">${filtro ? esc(PASTAS[filtro]) : 'Por validade'}</h2>
      ${lista.map((d) => `
        <button type="button" class="linha" data-doc="${d.id}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer">
          <span class="col"><span class="t">${esc(d.nome)}</span><span class="mini">${esc(PASTAS[d.pasta] || d.pasta)}${d.notas ? ' · ' + esc(d.notas) : ''}</span></span>
          <span class="v ${d.validade && diasAte(d.validade) <= 30 ? 'atencao' : ''}" style="font-size:13px">${d.validade ? dataCurta(d.validade) + '/' + d.validade.slice(2, 4) : 'sem validade'}</span>
        </button>`).join('') || '<p class="vazio">Nada aqui ainda. Ex.: “a CNH vence em março de 2028”.</p>'}
    </section>
    <p class="mini" style="margin:0;line-height:1.5">A Arca avisa na tela Hoje 30 dias antes de cada validade. Anexar a foto do documento chega na próxima etapa.</p>`;

  const form = (d = {}) => `
    <h2>${d.id ? 'Editar documento' : 'Novo documento'}</h2>
    <form class="form">
      <div class="campo"><label for="d-nome">Nome</label><input id="d-nome" name="nome" value="${esc(d.nome || '')}" placeholder="Ex.: CNH" required></div>
      <div class="grade-2">
        <div class="campo"><label for="d-pasta">Pasta</label><select id="d-pasta" name="pasta">${Object.entries(PASTAS).map(([k, n]) => `<option value="${k}" ${(d.pasta || filtro) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo"><label for="d-val">Validade</label><input id="d-val" name="validade" type="date" value="${d.validade || ''}"></div>
      </div>
      <div class="campo"><label for="d-notas">Observação</label><input id="d-notas" name="notas" value="${esc(d.notas || '')}" placeholder="Ex.: número da apólice, onde está guardado"></div>
      <div class="grade-2">${d.id ? '<button type="submit" class="btn" name="apagar" value="1">Apagar</button>' : '<button type="button" class="btn" data-fechar>Cancelar</button>'}<button class="btn primario" name="salvar" value="1">Salvar</button></div>
    </form>`;

  tela.querySelector('#novo-doc').addEventListener('click', async () => {
    const v = await folha(form());
    if (!v) return;
    await q(db.from('documentos').insert({ nome: v.nome, pasta: v.pasta, validade: v.validade || null, notas: v.notas || null }));
    recarregar();
  });

  tela.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', async () => {
    const d = docs.find((x) => x.id === b.dataset.doc);
    const fundo = folha(form(d));
    // o botão clicado define a ação
    let acao = 'salvar';
    document.querySelector('.folha form').addEventListener('click', (e) => { if (e.target.name) acao = e.target.name; });
    const v = await fundo;
    if (!v) return;
    if (acao === 'apagar') await q(db.from('documentos').delete().eq('id', d.id));
    else await q(db.from('documentos').update({ nome: v.nome, pasta: v.pasta, validade: v.validade || null, notas: v.notas || null }).eq('id', d.id));
    recarregar();
  }));
}

import { esc } from '../util.js';

const ICONES = {
  financas: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7l11-3v3M16 13h1"/>',
  documentos: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  saude: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  casa: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  veiculo: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v2M17 19v2"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-3.5-5.5"/>',
  metas: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  diario: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  ideias: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'
};

const SALAS = [
  { id: 'financas', nome: 'Finanças', desc: 'Gastos, contas, assinaturas', pronta: true },
  { id: 'documentos', nome: 'Documentos', desc: 'Cofre com validades', pronta: true },
  { id: 'saude', nome: 'Saúde', desc: 'Remédios, consultas, exames' },
  { id: 'casa', nome: 'Casa', desc: 'Contas, mercado, manutenção' },
  { id: 'veiculo', nome: 'Veículo', desc: 'Revisão, seguro, combustível' },
  { id: 'pessoas', nome: 'Pessoas', desc: 'Aniversários e presentes' },
  { id: 'metas', nome: 'Metas e hábitos', desc: 'Objetivos do ano' },
  { id: 'diario', nome: 'Diário', desc: 'Humor e registro do dia' },
  { id: 'ideias', nome: 'Ideias e projetos', desc: 'Caixa de entrada e mapas' }
];

export default function salas(tela) {
  tela.innerHTML = `
    <header><h1>Salas</h1><p class="sub">Tudo o que a Arca guarda, em um só lugar.</p></header>
    <div class="grade-2">
      ${SALAS.map((s) => `
        <a class="sala ${s.pronta ? '' : 'breve'}" href="${s.pronta ? '#/' + s.id : '#/capturar'}">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[s.id]}</svg></span>
          <span style="font-size:15px;font-weight:800">${esc(s.nome)}</span>
          <span class="mini" style="line-height:1.35">${esc(s.desc)}</span>
          ${s.pronta ? '' : '<span class="etiqueta">tela em breve</span>'}
        </a>`).join('')}
    </div>
    <p class="mini" style="line-height:1.5;margin:0">As salas marcadas como “tela em breve” já guardam dados pela captura. A tela de cada uma chega nas próximas etapas.</p>`;
}

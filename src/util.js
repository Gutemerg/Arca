// Escapa texto para HTML (todo dado do banco passa por aqui)
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (n) => brl.format(Number(n || 0));
export const reaisCurto = (n) => 'R$ ' + Math.round(Number(n || 0)).toLocaleString('pt-BR');

// Datas no fuso de São Paulo, sempre como 'AAAA-MM-DD'
export function hojeISO(desloc = 0) {
  const d = new Date(Date.now() + desloc * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
export function inicioMesISO() { return hojeISO().slice(0, 8) + '01'; }
export function diasAte(iso) {
  const a = new Date(hojeISO() + 'T00:00:00');
  const b = new Date(iso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
export function dataCurta(iso) {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}
export function quando(iso) {
  const n = diasAte(iso);
  if (n < 0) return n === -1 ? 'venceu ontem' : `venceu há ${-n} dias`;
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n <= 30) return `em ${n} dias`;
  return dataCurta(iso);
}
export function dataLonga() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date()).replace(/^./, (c) => c.toUpperCase());
}
export function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function aviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// Folha inferior com formulário; resolve com os valores ou null
export function folha(html) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'folha-fundo';
    fundo.innerHTML = `<div class="folha" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(fundo);
    const form = fundo.querySelector('form');
    const fechar = (v) => { fundo.remove(); resolve(v); };
    fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(null); });
    form?.addEventListener('submit', (e) => { e.preventDefault(); fechar(Object.fromEntries(new FormData(form))); });
    fundo.querySelector('input, select, textarea')?.focus();
  });
}

export const CORES = ['#4FD1A5', '#5B9CF5', '#B18CF0', '#F2B544', '#FF8A7A', '#7CD3E8', '#E58BD0', '#8A919C'];

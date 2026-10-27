// Aparência: claro (padrão), escuro ou igual ao sistema. Guardado só neste aparelho.
export const TEMAS = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'sistema', nome: 'Sistema' }
];

export function temaAtual() {
  return document.documentElement.dataset.tema || 'claro';
}

function corDaBarra() {
  return getComputedStyle(document.documentElement).getPropertyValue('--fundo').trim();
}

export function aplicarTema(id) {
  document.documentElement.dataset.tema = id;
  try { localStorage.setItem('arca-tema', id); } catch (e) {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', corDaBarra());
}

// Mantém a barra do celular na cor certa (inclusive quando o sistema troca)
aplicarTema(temaAtual());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (temaAtual() === 'sistema') aplicarTema('sistema');
});

import { registerSW } from 'virtual:pwa-register';
import './tema.js';
import { db, sessaoAtual, acessoLiberado } from './db.js';
import { aviso } from './util.js';
import login from './views/login.js';
import hoje from './views/hoje.js';
import capturar from './views/capturar.js';
import salas from './views/salas.js';
import financas from './views/financas.js';
import documentos from './views/documentos.js';

registerSW({ immediate: true });

const rotas = { hoje, capturar, salas, financas, documentos };
const tela = document.getElementById('tela');
const nav = document.getElementById('nav');

async function render() {
  const [nome, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const sessao = await sessaoAtual().catch(() => null);

  if (!sessao) {
    nav.hidden = true;
    return login(tela);
  }

  let liberado = null, motivo = '';
  try { liberado = await acessoLiberado(); }
  catch (e) { liberado = false; motivo = e.message; }
  if (liberado === false) {
    nav.hidden = true;
    const email = sessao.user?.email || 'esta conta';
    tela.innerHTML = `
      <section class="login">
        <div class="marca">
          <img src="/icons/icon-192.png" alt="">
          <div><h1>Acesso pendente</h1><p class="sub">${email.replace(/[<>&"]/g, '')} ainda não foi liberado na Arca.</p></div>
        </div>
        <p class="sub">Peça ao dono da Arca para autorizar este e-mail. Se você entrou com e-mail e senha, o endereço também precisa estar confirmado.</p>
        ${motivo ? `<p class="mini">Detalhe técnico: ${motivo.replace(/[<>&"]/g, '')}</p>` : ''}
        <button type="button" class="btn" id="tentar">Tentar de novo</button>
        <button type="button" class="btn" id="sair">Sair</button>
      </section>`;
    tela.querySelector('#tentar').addEventListener('click', () => render());
    tela.querySelector('#sair').addEventListener('click', async () => {
      await db.auth.signOut();
      location.hash = '#/';
      render();
    });
    return;
  }
  const rota = rotas[nome] ? nome : 'hoje';
  if (!rotas[nome]) history.replaceState(null, '', '#/hoje');

  nav.hidden = false;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  tela.innerHTML = '<p class="carregando">Carregando…</p>';
  try {
    await rotas[rota](tela, { sessao, params: new URLSearchParams(query), render });
  } catch (e) {
    console.error(e);
    tela.innerHTML = `<p class="carregando">Não consegui carregar agora. Verifique a internet e tente de novo.</p>`;
    aviso(e.message);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();

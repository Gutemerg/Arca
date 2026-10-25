import { db } from '../db.js';
import { aviso } from '../util.js';

export default function login(tela) {
  tela.innerHTML = `
    <section class="login">
      <div class="marca">
        <img src="/icons/icon-192.png" alt="">
        <div><h1>Arca</h1><p class="sub">Tudo da sua vida em um só lugar.</p></div>
      </div>
      <button type="button" class="btn primario" id="google">Entrar com Google</button>
      <div class="sep">ou com e-mail</div>
      <form class="form" id="form-email">
        <div class="campo"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" minlength="8" required></div>
        <div class="grade-2">
          <button class="btn" type="submit" name="acao" value="entrar">Entrar</button>
          <button class="btn" type="submit" name="acao" value="criar">Criar conta</button>
        </div>
      </form>
    </section>`;

  tela.querySelector('#google').addEventListener('click', async () => {
    const { error } = await db.auth.signIn.social({
      provider: 'google',
      callbackURL: location.origin + '/#/hoje'
    });
    if (error) aviso(error.message || 'Não deu para entrar com Google');
  });

  tela.querySelector('#form-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const acao = e.submitter?.value;
    const email = f.get('email'), password = f.get('senha');
    const r = acao === 'criar'
      ? await db.auth.signUp.email({ email, password, name: email.split('@')[0] })
      : await db.auth.signIn.email({ email, password });
    if (r.error) return aviso(r.error.message || 'E-mail ou senha incorretos');
    location.hash = '#/hoje';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

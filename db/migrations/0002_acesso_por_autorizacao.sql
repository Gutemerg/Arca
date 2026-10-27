-- Acesso só com autorização do dono da Arca.
-- Qualquer pessoa pode até criar uma conta no login, mas só enxerga ou grava
-- algo se o e-mail dela estiver em public.autorizados E estiver verificado
-- (Google verifica sozinho; e-mail/senha precisa da confirmação por código).
-- Para liberar alguém: insert into public.autorizados (email) values ('pessoa@exemplo.com');
-- Para tirar o acesso:  delete from public.autorizados where email = 'pessoa@exemplo.com';

create table public.autorizados (
  email      text primary key check (email = lower(email)),
  criado_em  timestamptz not null default now()
);

-- Ninguém pelo app lê ou altera a lista: só o dono, direto no banco.
alter table public.autorizados enable row level security;
revoke all on public.autorizados from public, authenticated, anonymous;

create or replace function public.arca_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from neon_auth."user" u
    join public.autorizados a on a.email = lower(u.email)
    where u.id::text = auth.user_id()
      and u."emailVerified"
  );
$$;

revoke all on function public.arca_autorizado() from public, anonymous;
grant execute on function public.arca_autorizado() to authenticated;

-- Regra de dono passa a exigir também a autorização.
do $$
declare t text;
begin
  for t in
    select tablename from pg_policies
    where schemaname = 'public' and policyname = 'dono'
  loop
    execute format('drop policy dono on public.%I', t);
    execute format(
      'create policy dono on public.%I for all to authenticated
         using (user_id = auth.user_id() and (select public.arca_autorizado()))
         with check (user_id = auth.user_id() and (select public.arca_autorizado()))', t);
  end loop;
end $$;

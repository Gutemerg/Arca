-- Conta bancária pelo Open Finance (Pluggy / Meu Pluggy)
-- A sincronização roda com o JWT do próprio usuário, então o RLS continua valendo:
-- cada pessoa só grava e lê os lançamentos do próprio banco.

create table banco_conexoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default auth.user_id(),
  provedor      text not null default 'pluggy' check (provedor in ('pluggy')),
  item_id       text not null,
  apelido       text,
  ultima_sync   timestamptz,
  ultimo_erro   text,
  criado_em     timestamptz not null default now(),
  unique (user_id, item_id)
);

-- Lançamentos vindos do banco: guardam o id da transação para nunca duplicar
alter table lancamentos add column externo_id text;
alter table lancamentos add column conta text;
alter table lancamentos add constraint lancamentos_externo_unico unique (user_id, externo_id);
alter table lancamentos drop constraint lancamentos_origem_check;
alter table lancamentos add constraint lancamentos_origem_check
  check (origem in ('manual','captura','importacao','banco'));

alter table banco_conexoes enable row level security;
create policy dono on banco_conexoes for all to authenticated
  using (user_id = auth.user_id() and (select public.arca_autorizado()))
  with check (user_id = auth.user_id() and (select public.arca_autorizado()));
grant select, insert, update, delete on banco_conexoes to authenticated;

-- Avisos por notificação (aparecem no celular e, espelhados, no relógio)
-- Um disparador (Cloudflare Worker com cron a cada 5 min) chama public.avisos_pendentes(),
-- que devolve os avisos do momento e já os marca como enviados (nunca repete).

create table avisos_enviados (
  chave      text primary key,           -- ex.: rotina:<id>:2026-11-12
  user_id    text not null,
  enviado_em timestamptz not null default now()
);
alter table avisos_enviados enable row level security;
revoke all on avisos_enviados from public, authenticated, anonymous;

create or replace function public.avisos_pendentes()
returns table (user_id text, titulo text, detalhe text, link text, endpoint text, p256dh text, auth text)
language sql
volatile
security definer
set search_path = ''
as $$
  with agora as (
    select (now() at time zone 'America/Sao_Paulo') as local
  ),
  base as (
    select a.local, a.local::date as hoje, a.local::time as hora from agora a
  ),
  candidatos as (
    -- Rotina: no horário, se ainda não foi feita hoje
    select h.user_id, 'rotina:' || h.id || ':' || b.hoje as chave,
           to_char(h.horario, 'HH24:MI') || ' · ' || h.nome as titulo,
           'Rotina' as detalhe, '/#/hoje' as link
    from public.habitos h, base b
    where h.ativo and h.horario is not null
      and h.horario <= b.hora and h.horario > b.hora - interval '15 minutes'
      and not exists (select 1 from public.habito_registros r where r.habito_id = h.id and r.data = b.hoje)
    union all
    -- Tarefas com hora marcada para hoje
    select t.user_id, 'tarefa:' || t.id || ':' || b.hoje,
           to_char(t.hora, 'HH24:MI') || ' · ' || t.titulo, coalesce(t.sala, 'Tarefa'), '/#/hoje'
    from public.tarefas t, base b
    where t.concluida_em is null and t.data = b.hoje and t.hora is not null
      and t.hora <= b.hora and t.hora > b.hora - interval '15 minutes'
    union all
    -- Consultas: 1 hora antes
    select c.user_id, 'consulta:' || c.id,
           'Em 1 hora: ' || c.titulo,
           to_char(c.data_hora at time zone 'America/Sao_Paulo', 'HH24:MI') || coalesce(' · ' || c.local, ''), '/#/hoje'
    from public.consultas c, agora a
    where c.status = 'agendada' and c.data_hora is not null
      and c.data_hora - interval '60 minutes' <= now() and c.data_hora > now()
    union all
    -- Contas: resumo diário às 8h (vencidas, hoje e amanhã)
    select x.user_id, 'contas:' || x.user_id || ':' || b.hoje,
           case when x.n = 1 then x.primeira else x.n || ' contas para pagar' end,
           x.resumo, '/#/financas'
    from base b,
    lateral (
      select cp.user_id, count(*) as n,
             min(cp.nome || case when cp.vencimento < b.hoje then ' venceu' when cp.vencimento = b.hoje then ' vence hoje' else ' vence amanhã' end) as primeira,
             string_agg(cp.nome || coalesce(' R$ ' || to_char(cp.valor, 'FM999G990D00'), ''), ' · ' order by cp.vencimento) as resumo
      from public.contas_pagar cp
      where cp.pago_em is null and cp.vencimento <= b.hoje + 1
      group by cp.user_id
    ) x
    where b.hora >= time '08:00'
    union all
    -- Documentos vencendo em até 7 dias: resumo diário às 8h
    select d.user_id, 'docs:' || d.user_id || ':' || b.hoje,
           case when count(*) = 1 then min(d.nome) || ' vence em breve' else count(*) || ' documentos vencendo' end,
           string_agg(d.nome || ' ' || to_char(d.validade, 'DD/MM'), ' · ' order by d.validade), '/#/documentos'
    from public.documentos d, base b
    where d.validade is not null and d.validade <= b.hoje + 7 and b.hora >= time '08:00'
    group by d.user_id, b.hoje
  ),
  novos as (
    insert into public.avisos_enviados (chave, user_id)
    select chave, user_id from candidatos
    on conflict (chave) do nothing
    returning chave
  )
  select c.user_id, c.titulo, c.detalhe, c.link, p.endpoint, p.p256dh, p.auth
  from candidatos c
  join novos n on n.chave = c.chave
  join public.push_assinaturas p on p.user_id = c.user_id
  where (select public.arca_autorizado_usuario(c.user_id));
$$;

-- Mesma regra da lista de autorizados, mas para um user_id informado (uso interno do disparador)
create or replace function public.arca_autorizado_usuario(uid text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from neon_auth."user" u
    join public.autorizados a on a.email = lower(u.email)
    where u.id::text = uid and u."emailVerified"
  );
$$;

-- Remove a assinatura de um aparelho que não existe mais (o serviço de push respondeu 404/410)
create or replace function public.avisos_remover_assinatura(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_assinaturas where endpoint = p_endpoint;
$$;

-- Usuário só do disparador: não lê tabela nenhuma, só chama estas duas funções
-- (criado pela API do Neon como "arca_avisos")
revoke all on function public.avisos_pendentes() from public, authenticated, anonymous;
revoke all on function public.avisos_remover_assinatura(text) from public, authenticated, anonymous;
revoke all on function public.arca_autorizado_usuario(text) from public, authenticated, anonymous;
grant usage on schema public to arca_avisos;
grant execute on function public.avisos_pendentes() to arca_avisos;
grant execute on function public.avisos_remover_assinatura(text) to arca_avisos;

-- Avisos mais insistentes: rotina e tarefas repetem em +10 e +20 min enquanto não forem feitas,
-- e cada aviso leva tipo e id para a notificação ter botões ("Feito") e ícone próprio.
drop function if exists public.avisos_pendentes();

create function public.avisos_pendentes()
returns table (user_id text, titulo text, detalhe text, link text, tipo text, item_id text, tentativa int,
               endpoint text, p256dh text, auth text)
language sql
volatile
security definer
set search_path = ''
as $$
  with base as (
    select (now() at time zone 'America/Sao_Paulo')::date as hoje,
           (now() at time zone 'America/Sao_Paulo')::time as hora
  ),
  candidatos as (
    -- Rotina: no horário e de novo em +10 e +20 min, enquanto não for marcada como feita
    select h.user_id, 'rotina:' || h.id || ':' || b.hoje || ':' || x.t as chave,
           case when x.t = 0 then '🔔 ' || to_char(h.horario, 'HH24:MI') || ' · ' || h.nome
                else '🔔 Ainda pendente · ' || h.nome end as titulo,
           case when x.t = 0 then 'Rotina' else 'Rotina das ' || to_char(h.horario, 'HH24:MI') end as detalhe,
           '/#/hoje' as link, 'rotina' as tipo, h.id::text as item_id, x.t as tentativa
    from public.habitos h, base b,
    lateral (select floor(extract(epoch from (b.hora - h.horario)) / 600)::int as t) x
    where h.ativo and h.horario is not null and b.hora >= h.horario and x.t between 0 and 2
      and not exists (select 1 from public.habito_registros r where r.habito_id = h.id and r.data = b.hoje)
    union all
    -- Tarefas com hora: mesmo esquema
    select t.user_id, 'tarefa:' || t.id || ':' || b.hoje || ':' || x.t,
           case when x.t = 0 then '✅ ' || to_char(t.hora, 'HH24:MI') || ' · ' || t.titulo
                else '✅ Ainda pendente · ' || t.titulo end,
           coalesce(t.sala, 'Tarefa'), '/#/hoje', 'tarefa', t.id::text, x.t
    from public.tarefas t, base b,
    lateral (select floor(extract(epoch from (b.hora - t.hora)) / 600)::int as t) x
    where t.concluida_em is null and t.data = b.hoje and t.hora is not null
      and b.hora >= t.hora and x.t between 0 and 2
    union all
    -- Consultas: 1 hora antes
    select c.user_id, 'consulta:' || c.id,
           '🩺 Em 1 hora: ' || c.titulo,
           to_char(c.data_hora at time zone 'America/Sao_Paulo', 'HH24:MI') || coalesce(' · ' || c.local, ''),
           '/#/hoje', 'consulta', c.id::text, 0
    from public.consultas c
    where c.status = 'agendada' and c.data_hora is not null
      and c.data_hora - interval '60 minutes' <= now() and c.data_hora > now()
    union all
    -- Contas: resumo às 8h (vencidas, hoje e amanhã)
    select x.user_id, 'contas:' || x.user_id || ':' || b.hoje,
           '💰 ' || case when x.n = 1 then x.primeira else x.n || ' contas para pagar' end,
           x.resumo, '/#/financas', 'contas', null, 0
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
    -- Documentos vencendo em até 7 dias: resumo às 8h
    select d.user_id, 'docs:' || d.user_id || ':' || b.hoje,
           '📄 ' || case when count(*) = 1 then min(d.nome) || ' vence em breve' else count(*) || ' documentos vencendo' end,
           string_agg(d.nome || ' ' || to_char(d.validade, 'DD/MM'), ' · ' order by d.validade),
           '/#/documentos', 'docs', null, 0
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
  select c.user_id, c.titulo, c.detalhe, c.link, c.tipo, c.item_id, c.tentativa, p.endpoint, p.p256dh, p.auth
  from candidatos c
  join novos n on n.chave = c.chave
  join public.push_assinaturas p on p.user_id = c.user_id
  where (select public.arca_autorizado_usuario(c.user_id));
$$;

revoke all on function public.avisos_pendentes() from public, authenticated, anonymous;
grant execute on function public.avisos_pendentes() to arca_avisos;

-- Responder aos avisos direto da notificação (celular ou relógio), sem abrir o app:
-- "▶ Fazendo" para as repetições e marca que você está executando;
-- "✓ Concluí" marca a rotina/tarefa como feita.
-- Cada aviso leva um código (token) assinado com um segredo que só o banco conhece,
-- então só a notificação verdadeira consegue marcar aquele item.

create table if not exists public.aviso_segredo (s text not null);
insert into public.aviso_segredo (s)
select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.aviso_segredo);
alter table public.aviso_segredo enable row level security;
revoke all on public.aviso_segredo from public, authenticated, anonymous;

create table if not exists public.avisos_status (
  user_id  text not null,
  tipo     text not null,
  item_id  text not null,
  dia      date not null,
  em       timestamptz not null default now(),
  primary key (tipo, item_id, dia)
);
alter table public.avisos_status enable row level security;
revoke all on public.avisos_status from public, authenticated, anonymous;

create or replace function public.aviso_token(p_tipo text, p_id text, p_dia date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to((select s from public.aviso_segredo limit 1) || ':' || p_tipo || ':' || p_id || ':' || p_dia::text, 'UTF8')), 'hex');
$$;
revoke all on function public.aviso_token(text, text, date) from public, authenticated, anonymous;

drop function if exists public.avisos_pendentes();

create function public.avisos_pendentes()
returns table (user_id text, titulo text, detalhe text, link text, tipo text, item_id text, tentativa int,
               dia text, token text, endpoint text, p256dh text, auth text)
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
    -- Rotina: no horário e de novo em +10 e +20 min, enquanto não for feita
    -- (se você tocou em "Fazendo", as repetições param)
    select h.user_id, 'rotina:' || h.id || ':' || b.hoje || ':' || x.t as chave,
           case when x.t = 0 then '🔔 ' || to_char(h.horario, 'HH24:MI') || ' · ' || h.nome
                else '🔔 Ainda pendente · ' || h.nome end as titulo,
           case when x.t = 0 then 'Rotina' else 'Rotina das ' || to_char(h.horario, 'HH24:MI') end as detalhe,
           '/#/hoje' as link, 'rotina' as tipo, h.id::text as item_id, x.t as tentativa, b.hoje as dia
    from public.habitos h, base b,
    lateral (select floor(extract(epoch from (b.hora - h.horario)) / 600)::int as t) x
    where h.ativo and h.horario is not null and b.hora >= h.horario and x.t between 0 and 2
      and not exists (select 1 from public.habito_registros r where r.habito_id = h.id and r.data = b.hoje)
      and not (x.t > 0 and exists (select 1 from public.avisos_status s where s.tipo = 'rotina' and s.item_id = h.id::text and s.dia = b.hoje))
    union all
    -- Tarefas com hora: mesmo esquema
    select t.user_id, 'tarefa:' || t.id || ':' || b.hoje || ':' || x.t,
           case when x.t = 0 then '✅ ' || to_char(t.hora, 'HH24:MI') || ' · ' || t.titulo
                else '✅ Ainda pendente · ' || t.titulo end,
           coalesce(t.sala, 'Tarefa'), '/#/hoje', 'tarefa', t.id::text, x.t, b.hoje
    from public.tarefas t, base b,
    lateral (select floor(extract(epoch from (b.hora - t.hora)) / 600)::int as t) x
    where t.concluida_em is null and t.data = b.hoje and t.hora is not null
      and b.hora >= t.hora and x.t between 0 and 2
      and not (x.t > 0 and exists (select 1 from public.avisos_status s where s.tipo = 'tarefa' and s.item_id = t.id::text and s.dia = b.hoje))
    union all
    -- Marcou "Fazendo" e 40 minutos depois ainda não concluiu: pergunta uma vez
    select s.user_id, 'checkin:' || s.tipo || ':' || s.item_id || ':' || s.dia,
           '⏳ Concluiu? · ' || coalesce(h.nome, t.titulo),
           'Você marcou que estava fazendo às ' || to_char(s.em at time zone 'America/Sao_Paulo', 'HH24:MI'),
           '/#/hoje', s.tipo, s.item_id, 9, s.dia
    from public.avisos_status s
    cross join base b
    left join public.habitos h on s.tipo = 'rotina' and h.id::text = s.item_id
    left join public.tarefas t on s.tipo = 'tarefa' and t.id::text = s.item_id
    where s.dia = b.hoje and s.em <= now() - interval '40 minutes'
      and coalesce(h.nome, t.titulo) is not null
      and (s.tipo <> 'rotina' or not exists (select 1 from public.habito_registros r where r.habito_id::text = s.item_id and r.data = s.dia))
      and (s.tipo <> 'tarefa' or t.concluida_em is null)
    union all
    -- Consultas: 1 hora antes
    select c.user_id, 'consulta:' || c.id,
           '🩺 Em 1 hora: ' || c.titulo,
           to_char(c.data_hora at time zone 'America/Sao_Paulo', 'HH24:MI') || coalesce(' · ' || c.local, ''),
           '/#/hoje', 'consulta', c.id::text, 0, null::date
    from public.consultas c
    where c.status = 'agendada' and c.data_hora is not null
      and c.data_hora - interval '60 minutes' <= now() and c.data_hora > now()
    union all
    -- Contas: resumo às 8h (vencidas, hoje e amanhã)
    select x.user_id, 'contas:' || x.user_id || ':' || b.hoje,
           '💰 ' || case when x.n = 1 then x.primeira else x.n || ' contas para pagar' end,
           x.resumo, '/#/financas', 'contas', null, 0, null::date
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
           '/#/documentos', 'docs', null, 0, null::date
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
  select c.user_id, c.titulo, c.detalhe, c.link, c.tipo, c.item_id, c.tentativa,
         c.dia::text,
         case when c.tipo in ('rotina', 'tarefa') then public.aviso_token(c.tipo, c.item_id, c.dia) end,
         p.endpoint, p.p256dh, p.auth
  from candidatos c
  join novos n on n.chave = c.chave
  join public.push_assinaturas p on p.user_id = c.user_id
  where (select public.arca_autorizado_usuario(c.user_id));
$$;

-- Resposta vinda da notificação: confere o código e marca
create or replace function public.aviso_responder(p_tipo text, p_id text, p_dia date, p_token text, p_acao text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user text;
  v_nome text;
begin
  if p_token is null or p_token <> public.aviso_token(p_tipo, p_id, p_dia) then
    raise exception 'código inválido';
  end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date - 1 then
    raise exception 'aviso expirado';
  end if;

  if p_tipo = 'rotina' then
    select h.user_id, h.nome into v_user, v_nome from public.habitos h where h.id::text = p_id;
  elsif p_tipo = 'tarefa' then
    select t.user_id, t.titulo into v_user, v_nome from public.tarefas t where t.id::text = p_id;
  else
    raise exception 'tipo inválido';
  end if;
  if v_user is null then raise exception 'item não encontrado'; end if;

  if p_acao = 'feito' then
    if p_tipo = 'rotina' then
      insert into public.habito_registros (habito_id, user_id, data) values (p_id::uuid, v_user, p_dia)
      on conflict do nothing;
    else
      update public.tarefas set concluida_em = coalesce(concluida_em, now()) where id::text = p_id;
    end if;
    delete from public.avisos_status where tipo = p_tipo and item_id = p_id and dia = p_dia;
  elsif p_acao = 'executando' then
    insert into public.avisos_status (user_id, tipo, item_id, dia) values (v_user, p_tipo, p_id, p_dia)
    on conflict (tipo, item_id, dia) do update set em = now();
  else
    raise exception 'ação inválida';
  end if;
  return v_nome;
end;
$$;

revoke all on function public.avisos_pendentes() from public, authenticated, anonymous;
revoke all on function public.aviso_responder(text, text, date, text, text) from public, authenticated, anonymous;
grant execute on function public.avisos_pendentes() to arca_avisos;
grant execute on function public.aviso_responder(text, text, date, text, text) to arca_avisos;

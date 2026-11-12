-- Sala Treino: treinos montados, exercícios, sessões e séries realizadas.
-- Mesma regra de dono + autorização das demais tabelas.

create table treinos (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,                  -- ex.: "Treino A · Peito e tríceps"
  tipo        text not null default 'musculacao' check (tipo in ('musculacao','corrida','cardio','funcional','outro')),
  dias        smallint[] not null default '{}', -- 0=domingo … 6=sábado
  ordem       int not null default 0,
  ativo       boolean not null default true,
  notas       text,
  criado_em   timestamptz not null default now()
);

create table treino_exercicios (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default auth.user_id(),
  treino_id     uuid not null references treinos(id) on delete cascade,
  nome          text not null,               -- ex.: "Supino reto com barra"
  grupo         text,                        -- ex.: "Peito"
  ordem         int not null default 0,
  series        smallint not null default 3,
  reps_min      smallint,                    -- faixa alvo, ex.: 8–12
  reps_max      smallint,
  descanso_seg  smallint not null default 90,
  notas         text,
  criado_em     timestamptz not null default now()
);
create index on treino_exercicios (treino_id, ordem);

create table exercicios_custom (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,
  grupo       text not null default 'Outros',
  criado_em   timestamptz not null default now(),
  unique (user_id, nome)
);

create table treino_sessoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default auth.user_id(),
  treino_id    uuid references treinos(id) on delete set null,
  nome         text not null,                -- nome do treino no dia (fica mesmo se o treino mudar)
  tipo         text not null default 'musculacao',
  inicio       timestamptz not null default now(),
  fim          timestamptz,
  duracao_min  int,
  distancia_km numeric(6,2),                 -- corrida/cardio
  esforco      smallint check (esforco between 1 and 10),
  notas        text
);
create index on treino_sessoes (user_id, inicio desc);

create table treino_series (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  sessao_id   uuid not null references treino_sessoes(id) on delete cascade,
  exercicio   text not null,                 -- nome do exercício (histórico por nome)
  grupo       text,
  serie_n     smallint not null,
  carga       numeric(6,2),                  -- kg
  reps        smallint,
  feito_em    timestamptz not null default now()
);
create index on treino_series (user_id, exercicio, feito_em desc);

do $$
declare t text;
begin
  foreach t in array array['treinos','treino_exercicios','exercicios_custom','treino_sessoes','treino_series'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy dono on public.%I for all to authenticated
         using (user_id = auth.user_id() and (select public.arca_autorizado()))
         with check (user_id = auth.user_id() and (select public.arca_autorizado()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

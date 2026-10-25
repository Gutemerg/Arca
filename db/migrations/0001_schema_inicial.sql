-- Arca — esquema inicial
-- Cada tabela guarda user_id (sub do JWT do Neon Auth) e é protegida por RLS:
-- cada usuário só lê e altera as próprias linhas.

-- ============ Perfil ============
create table perfil (
  user_id     text primary key default auth.user_id(),
  nome        text,
  fuso        text not null default 'America/Sao_Paulo',
  criado_em   timestamptz not null default now()
);

-- ============ Finanças ============
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,
  tipo        text not null default 'saida' check (tipo in ('entrada','saida')),
  cor         text,
  criado_em   timestamptz not null default now(),
  unique (user_id, nome, tipo)
);

create table lancamentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default auth.user_id(),
  tipo          text not null check (tipo in ('entrada','saida')),
  valor         numeric(12,2) not null check (valor >= 0),
  descricao     text not null,
  categoria_id  uuid references categorias(id) on delete set null,
  data          date not null default current_date,
  sala          text,
  origem        text not null default 'manual' check (origem in ('manual','captura','importacao')),
  criado_em     timestamptz not null default now()
);
create index on lancamentos (user_id, data desc);

create table contas_pagar (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null default auth.user_id(),
  nome               text not null,
  valor              numeric(12,2),
  vencimento         date not null,
  recorrencia        text not null default 'mensal' check (recorrencia in ('unica','mensal','anual')),
  sala               text not null default 'financas',
  debito_automatico  boolean not null default false,
  pago_em            date,
  lancamento_id      uuid references lancamentos(id) on delete set null,
  criado_em          timestamptz not null default now()
);
create index on contas_pagar (user_id, vencimento);

create table assinaturas (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null default auth.user_id(),
  nome              text not null,
  valor             numeric(12,2) not null,
  ciclo             text not null default 'mensal' check (ciclo in ('mensal','anual')),
  proxima_cobranca  date,
  ultimo_uso        date,
  ativa             boolean not null default true,
  criado_em         timestamptz not null default now()
);

create table caixinhas (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,
  meta        numeric(12,2),
  saldo       numeric(12,2) not null default 0,
  criado_em   timestamptz not null default now()
);

-- ============ Documentos ============
create table documentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default auth.user_id(),
  nome         text not null,
  pasta        text not null default 'outros',
  validade     date,
  arquivo_url  text,
  notas        text,
  criado_em    timestamptz not null default now()
);
create index on documentos (user_id, validade);

-- ============ Veículo ============
create table veiculos (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  apelido     text not null default 'Meu carro',
  modelo      text,
  placa       text,
  ano         int,
  km_atual    int,
  criado_em   timestamptz not null default now()
);

create table veiculo_eventos (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null default auth.user_id(),
  veiculo_id     uuid not null references veiculos(id) on delete cascade,
  tipo           text not null check (tipo in ('abastecimento','manutencao','revisao','seguro','ipva','licenciamento','multa','outro')),
  descricao      text,
  data           date not null default current_date,
  km             int,
  valor          numeric(12,2),
  litros         numeric(8,2),
  proximo_km     int,
  proxima_data   date,
  criado_em      timestamptz not null default now()
);
create index on veiculo_eventos (user_id, veiculo_id, data desc);

-- ============ Casa ============
create table compras (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  item        text not null,
  comprado    boolean not null default false,
  criado_em   timestamptz not null default now()
);

create table manutencoes_casa (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null default auth.user_id(),
  nome            text not null,
  intervalo_dias  int,
  ultima_data     date,
  proxima_data    date,
  criado_em       timestamptz not null default now()
);

-- ============ Tarefas e agenda ============
create table tarefas (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default auth.user_id(),
  titulo        text not null,
  detalhe       text,
  sala          text,
  data          date,
  hora          time,
  concluida_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index on tarefas (user_id, data);

-- ============ Saúde ============
create table remedios (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,
  dose        text,
  horarios    time[] not null default '{}',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table remedio_doses (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  remedio_id  uuid not null references remedios(id) on delete cascade,
  data        date not null default current_date,
  horario     time not null,
  tomado_em   timestamptz not null default now(),
  unique (remedio_id, data, horario)
);

create table saude_registros (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  tipo        text not null check (tipo in ('sono','agua','peso','passos','treino','pressao','outro')),
  valor       numeric(10,2),
  unidade     text,
  nota        text,
  data        date not null default current_date,
  criado_em   timestamptz not null default now()
);
create index on saude_registros (user_id, tipo, data desc);

create table consultas (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  titulo      text not null,
  tipo        text not null default 'consulta' check (tipo in ('consulta','exame','vacina')),
  data_hora   timestamptz,
  local       text,
  status      text not null default 'agendada' check (status in ('pendente','agendada','feita','cancelada')),
  notas       text,
  criado_em   timestamptz not null default now()
);

-- ============ Metas e hábitos ============
create table metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  titulo      text not null,
  alvo        numeric(12,2),
  atual       numeric(12,2) not null default 0,
  unidade     text,
  prazo       date,
  caixinha_id uuid references caixinhas(id) on delete set null,
  concluida   boolean not null default false,
  criado_em   timestamptz not null default now()
);

create table habitos (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  nome        text not null,
  meta_id     uuid references metas(id) on delete set null,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table habito_registros (
  habito_id   uuid not null references habitos(id) on delete cascade,
  user_id     text not null default auth.user_id(),
  data        date not null default current_date,
  primary key (habito_id, data)
);

-- ============ Diário ============
create table diario (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  data        date not null default current_date,
  humor       smallint check (humor between 1 and 5),
  texto       text,
  criado_em   timestamptz not null default now(),
  unique (user_id, data)
);

-- ============ Pessoas ============
create table pessoas (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null default auth.user_id(),
  nome                     text not null,
  relacao                  text,
  aniversario              date,
  contato_frequencia_dias  int,
  ultimo_contato           date,
  gostos                   text,
  notas                    text,
  criado_em                timestamptz not null default now()
);

create table presentes_ideias (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  pessoa_id   uuid not null references pessoas(id) on delete cascade,
  ideia       text not null,
  comprado    boolean not null default false,
  criado_em   timestamptz not null default now()
);

-- ============ Ideias, projetos e mapas mentais ============
create table projetos (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null default auth.user_id(),
  titulo         text not null,
  progresso      int not null default 0 check (progresso between 0 and 100),
  proximo_passo  text,
  status         text not null default 'ativo' check (status in ('ativo','pausado','concluido')),
  atualizado_em  timestamptz not null default now(),
  criado_em      timestamptz not null default now()
);

create table ideias (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  titulo      text not null,
  detalhe     text,
  etiquetas   text[] not null default '{}',
  status      text not null default 'nova' check (status in ('nova','projeto','arquivada')),
  projeto_id  uuid references projetos(id) on delete set null,
  criado_em   timestamptz not null default now()
);

-- nos: [{ "id": "n1", "texto": "...", "pai": null, "x": 0, "y": 0, "cor": "#4FD1A5" }]
create table mapas_mentais (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null default auth.user_id(),
  titulo         text not null,
  projeto_id     uuid references projetos(id) on delete set null,
  nos            jsonb not null default '[]',
  atualizado_em  timestamptz not null default now(),
  criado_em      timestamptz not null default now()
);

-- ============ IA: capturas e alertas ============
create table capturas (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null default auth.user_id(),
  texto            text not null,
  resultado        jsonb,
  tabela_destino   text,
  registro_id      uuid,
  criado_em        timestamptz not null default now()
);

create table alertas (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  titulo      text not null,
  detalhe     text,
  sala        text,
  nivel       text not null default 'info' check (nivel in ('info','atencao','urgente')),
  link        text,
  chave       text,             -- evita alertas duplicados (ex.: 'conta:<id>:<venc>')
  lido_em     timestamptz,
  criado_em   timestamptz not null default now(),
  unique (user_id, chave)
);

create table push_assinaturas (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default auth.user_id(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);

-- ============ RLS: cada um vê só o que é seu ============
do $$
declare t text;
begin
  foreach t in array array[
    'perfil','categorias','lancamentos','contas_pagar','assinaturas','caixinhas',
    'documentos','veiculos','veiculo_eventos','compras','manutencoes_casa','tarefas',
    'remedios','remedio_doses','saude_registros','consultas','metas','habitos',
    'habito_registros','diario','pessoas','presentes_ideias','projetos','ideias',
    'mapas_mentais','capturas','alertas','push_assinaturas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy dono on %I for all to authenticated
         using (user_id = auth.user_id())
         with check (user_id = auth.user_id())', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

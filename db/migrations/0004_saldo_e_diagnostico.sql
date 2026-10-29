-- Saldo da conta corrente e diagnóstico da última sincronização
alter table banco_conexoes add column saldo numeric(14,2);
alter table banco_conexoes add column saldo_em timestamptz;
alter table banco_conexoes add column ultimo_resumo jsonb;

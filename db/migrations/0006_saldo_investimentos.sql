-- Conta de investimentos separada da conta corrente
alter table banco_conexoes add column if not exists saldo_investimentos numeric(14,2);
alter table banco_conexoes add column if not exists investimentos jsonb;

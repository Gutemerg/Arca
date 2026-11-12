-- Contas fixas criadas a partir de pagamentos do banco: "padrao" é a descrição normalizada
-- do favorecido, usada para dar baixa sozinha quando o próximo pagamento chegar.
alter table contas_pagar add column if not exists padrao text;
create index if not exists contas_pagar_padrao on contas_pagar (user_id, padrao);

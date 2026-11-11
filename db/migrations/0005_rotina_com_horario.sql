-- Rotina: cada item (antes "hábito") pode ter um horário do dia.
alter table habitos add column if not exists horario time;

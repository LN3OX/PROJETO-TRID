-- Pedidos: cada orçamento salvo ganha um status de produção e uma data de entrega.
-- orcado → aprovado → fila → imprimindo → acabamento → pronto → entregue (ou recusado).
-- Expande sem quebrar: colunas novas com padrão; orçamentos antigos ficam como "orcado".
alter table public.projetotrid_quotes
  add column if not exists status text not null default 'orcado'
    check (status in ('orcado', 'aprovado', 'fila', 'imprimindo', 'acabamento', 'pronto', 'entregue', 'recusado')),
  add column if not exists status_at timestamptz not null default now(),
  add column if not exists due_date date;

-- orçamentos antigos: o tempo "sem resposta" conta a partir de quando foram criados
update public.projetotrid_quotes set status_at = created_at where status = 'orcado' and status_at > created_at;

create index if not exists projetotrid_quotes_owner_status_idx on public.projetotrid_quotes (owner_id, status, status_at desc);

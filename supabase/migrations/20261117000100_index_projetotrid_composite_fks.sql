-- Índices que cobrem as chaves estrangeiras compostas (owner_id primeiro, como nas políticas de acesso).
drop index if exists public.projetotrid_print_requests_print_idx;
drop index if exists public.projetotrid_print_requests_customer_idx;
drop index if exists public.projetotrid_print_requests_quote_idx;

create index if not exists projetotrid_print_requests_owner_print_idx
  on public.projetotrid_print_requests (owner_id, print_id, requested_at desc);
create index if not exists projetotrid_print_requests_owner_customer_idx
  on public.projetotrid_print_requests (owner_id, customer_id) where customer_id is not null;
create index if not exists projetotrid_print_requests_owner_quote_idx
  on public.projetotrid_print_requests (owner_id, quote_id) where quote_id is not null;

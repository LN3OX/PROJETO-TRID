-- Histórico de impressões: uma linha por peça impressa (valores só de impressão, por peça)
-- e uma linha por pedido em que ela foi orçada (cliente e data).

create table if not exists public.projetotrid_prints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  material text not null default '' check (char_length(material) <= 80),
  color text not null default '' check (char_length(color) <= 40),
  weight_g numeric(10,2) not null default 0 check (weight_g >= 0),
  print_minutes integer not null default 0 check (print_minutes >= 0),
  material_cost numeric(12,2) not null default 0 check (material_cost >= 0),
  energy_cost numeric(12,2) not null default 0 check (energy_cost >= 0),
  machine_cost numeric(12,2) not null default 0 check (machine_cost >= 0),
  print_cost numeric(12,2) not null default 0 check (print_cost >= 0),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- a mesma peça no mesmo material é um único registro por usuário
create unique index if not exists projetotrid_prints_owner_name_material_uq
  on public.projetotrid_prints (owner_id, lower(btrim(name)), lower(btrim(material)));

create table if not exists public.projetotrid_print_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  print_id uuid not null references public.projetotrid_prints(id) on delete cascade,
  customer_id uuid references public.projetotrid_customers(id) on delete set null,
  customer_name text not null default '' check (char_length(customer_name) <= 80),
  quote_id uuid references public.projetotrid_quotes(id) on delete set null,
  quantity integer not null default 1 check (quantity >= 1),
  unit_print_cost numeric(12,2) not null default 0 check (unit_print_cost >= 0),
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists projetotrid_print_requests_print_idx
  on public.projetotrid_print_requests (print_id, requested_at desc);
create index if not exists projetotrid_print_requests_owner_idx
  on public.projetotrid_print_requests (owner_id, requested_at desc);
create index if not exists projetotrid_print_requests_customer_idx
  on public.projetotrid_print_requests (customer_id) where customer_id is not null;
create index if not exists projetotrid_print_requests_quote_idx
  on public.projetotrid_print_requests (quote_id) where quote_id is not null;

alter table public.projetotrid_prints enable row level security;
alter table public.projetotrid_print_requests enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projetotrid_prints','projetotrid_print_requests'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = owner_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = owner_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = owner_id)', t || '_delete_own', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- Arquivos STL/3MF: bucket privado, 50 MB por arquivo, cada usuário só acessa a própria pasta (<id do usuário>/...).
insert into storage.buckets (id, name, public, file_size_limit)
values ('projetotrid-models', 'projetotrid-models', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists projetotrid_models_select_own on storage.objects;
create policy projetotrid_models_select_own on storage.objects for select to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists projetotrid_models_insert_own on storage.objects;
create policy projetotrid_models_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = auth.uid()::text and name ~* '\.(stl|3mf)$');

drop policy if exists projetotrid_models_update_own on storage.objects;
create policy projetotrid_models_update_own on storage.objects for update to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists projetotrid_models_delete_own on storage.objects;
create policy projetotrid_models_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = auth.uid()::text);

-- Estoque de filamento: um registro por rolo (material, cor, marca, quanto resta).
-- O app desconta o consumo ao salvar uma impressão no histórico e avisa quando o rolo não basta para o pedido.
create table if not exists public.projetotrid_spools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  material text not null check (char_length(btrim(material)) between 1 and 80),
  color text not null default '' check (char_length(color) <= 40),
  brand text not null default '' check (char_length(brand) <= 60),
  weight_g numeric(10,2) not null default 1000 check (weight_g > 0),
  remaining_g numeric(10,2) not null default 1000 check (remaining_g >= 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projetotrid_spools enable row level security;

create policy projetotrid_spools_select_own on public.projetotrid_spools for select to authenticated using ((select auth.uid()) = owner_id);
create policy projetotrid_spools_insert_own on public.projetotrid_spools for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projetotrid_spools_update_own on public.projetotrid_spools for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projetotrid_spools_delete_own on public.projetotrid_spools for delete to authenticated using ((select auth.uid()) = owner_id);

create index if not exists projetotrid_spools_owner_material_idx on public.projetotrid_spools (owner_id, lower(material), lower(color));

create trigger projetotrid_spools_touch_updated_at before update on public.projetotrid_spools
  for each row execute function public.projetotrid_touch_updated_at();

revoke all on table public.projetotrid_spools from anon;
revoke all on table public.projetotrid_spools from authenticated;
grant select, insert, update, delete on table public.projetotrid_spools to authenticated;

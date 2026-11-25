-- Vitrine pública: vitrine.html?loja=<slug> mostra as peças marcadas pelo dono, com foto, preço e um botão
-- "Quero uma igual" que abre o WhatsApp da loja. Visitantes não escrevem nada no banco.
-- Segurança: tabelas fechadas ao anon; a página lê por projetotrid_showcase (security definer), que devolve
-- só nome, material, cor, preço de vitrine, descrição e foto das peças marcadas. Custos nunca saem (D17).

create table if not exists public.projetotrid_shop (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  name text not null default '' check (char_length(name) <= 60),
  whatsapp text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  intro text not null default '' check (char_length(intro) <= 300),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projetotrid_shop enable row level security;
create policy projetotrid_shop_select_own on public.projetotrid_shop for select to authenticated using ((select auth.uid()) = owner_id);
create policy projetotrid_shop_insert_own on public.projetotrid_shop for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projetotrid_shop_update_own on public.projetotrid_shop for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projetotrid_shop_delete_own on public.projetotrid_shop for delete to authenticated using ((select auth.uid()) = owner_id);
create trigger projetotrid_shop_touch_updated_at before update on public.projetotrid_shop
  for each row execute function public.projetotrid_touch_updated_at();
revoke all on table public.projetotrid_shop from anon;
revoke all on table public.projetotrid_shop from authenticated;
grant select, insert, update, delete on table public.projetotrid_shop to authenticated;

alter table public.projetotrid_prints
  add column if not exists showcase boolean not null default false,
  add column if not exists showcase_price numeric(12,2) check (showcase_price is null or showcase_price >= 0),
  add column if not exists showcase_text text not null default '' check (char_length(showcase_text) <= 300),
  add column if not exists photo_path text check (photo_path is null or char_length(photo_path) <= 300);

-- fotos da vitrine: bucket público (só imagens, até 5 MB), cada dono escreve só na própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projetotrid-vitrine', 'projetotrid-vitrine', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- leitura via API só da própria pasta (o Storage exige select para remover a foto antiga); o público lê pela URL pública
create policy projetotrid_vitrine_select_own on storage.objects for select to authenticated
  using (bucket_id = 'projetotrid-vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy projetotrid_vitrine_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'projetotrid-vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~* '\.(jpe?g|png|webp)$');
create policy projetotrid_vitrine_update_own on storage.objects for update to authenticated
  using (bucket_id = 'projetotrid-vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'projetotrid-vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~* '\.(jpe?g|png|webp)$');
create policy projetotrid_vitrine_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'projetotrid-vitrine' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.projetotrid_showcase(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', s.name,
    'intro', s.intro,
    'whatsapp', s.whatsapp,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'material', p.material, 'color', p.color,
        'price', p.showcase_price, 'text', p.showcase_text, 'photo_path', p.photo_path
      ) order by p.updated_at desc)
      from public.projetotrid_prints p
      where p.owner_id = s.owner_id and p.showcase
    ), '[]'::jsonb)
  )
  from public.projetotrid_shop s
  where s.enabled and s.slug = lower(p_slug);
$$;

revoke all on function public.projetotrid_showcase(text) from public;
grant execute on function public.projetotrid_showcase(text) to anon, authenticated;

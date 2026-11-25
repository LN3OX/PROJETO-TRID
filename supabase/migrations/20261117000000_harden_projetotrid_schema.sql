-- Endurecimento do esquema (as tabelas estavam vazias no momento da aplicação).

-- 1) Políticas de acesso mais rápidas: auth.uid() avaliado uma vez por consulta, não por linha.
do $$
declare t text;
begin
  foreach t in array array['projetotrid_quotes','projetotrid_customers','projetotrid_prints','projetotrid_print_requests'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t || '_delete_own', t);
  end loop;
end $$;

drop policy if exists projetotrid_models_select_own on storage.objects;
create policy projetotrid_models_select_own on storage.objects for select to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists projetotrid_models_insert_own on storage.objects;
create policy projetotrid_models_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~* '\.(stl|3mf)$');
drop policy if exists projetotrid_models_update_own on storage.objects;
create policy projetotrid_models_update_own on storage.objects for update to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~* '\.(stl|3mf)$');
drop policy if exists projetotrid_models_delete_own on storage.objects;
create policy projetotrid_models_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'projetotrid-models' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2) Integridade entre usuários: um pedido só pode apontar para peça, cliente e orçamento do mesmo dono.
alter table public.projetotrid_prints add constraint projetotrid_prints_owner_id_id_uq unique (owner_id, id);
alter table public.projetotrid_customers add constraint projetotrid_customers_owner_id_id_uq unique (owner_id, id);
alter table public.projetotrid_quotes add constraint projetotrid_quotes_owner_id_id_uq unique (owner_id, id);

alter table public.projetotrid_print_requests drop constraint projetotrid_print_requests_print_id_fkey;
alter table public.projetotrid_print_requests drop constraint projetotrid_print_requests_customer_id_fkey;
alter table public.projetotrid_print_requests drop constraint projetotrid_print_requests_quote_id_fkey;

alter table public.projetotrid_print_requests
  add constraint projetotrid_print_requests_print_fk foreign key (owner_id, print_id)
    references public.projetotrid_prints (owner_id, id) on delete cascade,
  add constraint projetotrid_print_requests_customer_fk foreign key (owner_id, customer_id)
    references public.projetotrid_customers (owner_id, id) on delete set null (customer_id),
  add constraint projetotrid_print_requests_quote_fk foreign key (owner_id, quote_id)
    references public.projetotrid_quotes (owner_id, id) on delete set null (quote_id);

-- 3) updated_at sempre correto, mesmo se o aplicativo esquecer de preencher.
create or replace function public.projetotrid_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projetotrid_quotes','projetotrid_customers','projetotrid_prints'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.projetotrid_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

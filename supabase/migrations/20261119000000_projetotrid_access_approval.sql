-- Aprovação de acessos: quem entra pelo Google fica "pendente" até o dono aprovar.
-- Depois de aprovado, tudo funciona como antes (cada conta continua vendo só os próprios dados).
-- Para aprovar:  update public.projetotrid_access set status = 'approved' where email = 'pessoa@gmail.com';
-- Para bloquear: update public.projetotrid_access set status = 'blocked'  where email = 'pessoa@gmail.com';

create table if not exists public.projetotrid_access (
  email text primary key check (email = lower(email)),
  user_id uuid unique references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  note text not null default ''
);
alter table public.projetotrid_access enable row level security;
alter table public.projetotrid_access force row level security;
revoke all on public.projetotrid_access from anon, authenticated;
grant select on public.projetotrid_access to authenticated;

-- cada pessoa lê só a própria linha (para o app saber se foi aprovada)
create policy projetotrid_access_select_own on public.projetotrid_access
  for select to authenticated using (user_id = (select auth.uid()));

-- aprovada? (usada pelas regras de todas as tabelas)
create or replace function public.projetotrid_is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projetotrid_access a where a.user_id = (select auth.uid()) and a.status = 'approved');
$$;
revoke all on function public.projetotrid_is_approved() from public, anon;
grant execute on function public.projetotrid_is_approved() to authenticated;

-- o app chama ao entrar: registra o pedido de acesso (pendente) e devolve o status
create or replace function public.projetotrid_request_access()
returns text language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce((select auth.jwt()) ->> 'email', '')); v_status text;
begin
  if (select auth.uid()) is null or v_email = '' then return 'blocked'; end if;
  insert into public.projetotrid_access (email, user_id) values (v_email, (select auth.uid()))
  on conflict (email) do update set user_id = coalesce(public.projetotrid_access.user_id, excluded.user_id)
  returning status into v_status;
  return v_status;
end $$;
revoke all on function public.projetotrid_request_access() from public, anon;
grant execute on function public.projetotrid_request_access() to authenticated;

-- toda conta nova no Google já aparece como pendente (assim você a vê na tabela sem esperar o primeiro acesso ao app)
create or replace function public.projetotrid_on_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    insert into public.projetotrid_access (email, user_id) values (lower(new.email), new.id)
    on conflict (email) do update set user_id = coalesce(public.projetotrid_access.user_id, excluded.user_id);
  end if;
  return new;
end $$;
revoke all on function public.projetotrid_on_new_user() from public, anon, authenticated;
drop trigger if exists projetotrid_on_new_user on auth.users;
create trigger projetotrid_on_new_user after insert on auth.users for each row execute function public.projetotrid_on_new_user();

-- contas que já existem e usam o sistema: aprovadas (a terceira, sem dados, fica pendente)
insert into public.projetotrid_access (email, user_id, status, decided_at, note)
select lower(u.email), u.id, case when lower(u.email) in ('3d.inventta@gmail.com', 'lucaslacerda.ti@gmail.com') then 'approved' else 'pending' end,
       case when lower(u.email) in ('3d.inventta@gmail.com', 'lucaslacerda.ti@gmail.com') then now() end, 'migração inicial'
from auth.users u where u.email is not null
on conflict (email) do nothing;

-- as regras de todas as tabelas passam a exigir aprovação (restritivas: somam-se às de "só os próprios dados")
do $$
declare t text;
begin
  foreach t in array array['projetotrid_quotes', 'projetotrid_customers', 'projetotrid_prints', 'projetotrid_print_requests', 'projetotrid_spools', 'projetotrid_printers', 'projetotrid_shop'] loop
    execute format('drop policy if exists %I on public.%I', t || '_approved_only', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select public.projetotrid_is_approved())) with check ((select public.projetotrid_is_approved()))', t || '_approved_only', t);
  end loop;
end $$;

-- Tela de aprovação de acessos dentro do app.
-- Quem tem is_admin = true vê no menu da conta a opção "Aprovar acessos" e pode aprovar ou bloquear outras contas.
-- Para tornar alguém administrador (só pelo SQL Editor, de propósito):
--   update public.projetotrid_access set is_admin = true where email = 'pessoa@gmail.com';

alter table public.projetotrid_access add column if not exists is_admin boolean not null default false;

-- a conta atual é administradora (e aprovada)?
create or replace function public.projetotrid_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projetotrid_access a
    where a.user_id = (select auth.uid()) and a.status = 'approved' and a.is_admin
  );
$$;
revoke all on function public.projetotrid_is_admin() from public, anon;
grant execute on function public.projetotrid_is_admin() to authenticated;

-- lista de todas as contas que pediram acesso (só para administradores)
create or replace function public.projetotrid_access_list()
returns table (email text, status text, requested_at timestamptz, decided_at timestamptz, is_admin boolean, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.projetotrid_is_admin() then
    raise exception 'apenas administradores' using errcode = '42501';
  end if;
  return query
    select a.email, a.status, a.requested_at, a.decided_at, a.is_admin, a.user_id = (select auth.uid())
    from public.projetotrid_access a
    order by (a.status = 'pending') desc, a.requested_at desc;
end $$;
revoke all on function public.projetotrid_access_list() from public, anon;
grant execute on function public.projetotrid_access_list() to authenticated;

-- aprova ou bloqueia uma conta (só para administradores; ninguém muda o próprio acesso)
create or replace function public.projetotrid_access_set(p_email text, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if not public.projetotrid_is_admin() then
    raise exception 'apenas administradores' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'blocked', 'pending') then
    raise exception 'status inválido' using errcode = '22023';
  end if;
  update public.projetotrid_access a
     set status = p_status, decided_at = case when p_status = 'pending' then null else now() end
   where a.email = lower(btrim(p_email))
     and a.user_id is distinct from (select auth.uid())
  returning a.status into v_status;
  if v_status is null then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  return v_status;
end $$;
revoke all on function public.projetotrid_access_set(text, text) from public, anon;
grant execute on function public.projetotrid_access_set(text, text) to authenticated;

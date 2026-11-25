-- Link de aprovação: o cliente abre aprovar.html?t=<token>, vê o orçamento e aprova ou pede ajuste, sem login.
-- Segurança: a tabela continua fechada ao anon. As duas funções abaixo (security definer) só funcionam com o
-- token (uuid aleatório criado pelo dono) e só devolvem o que o cliente já veria no orçamento enviado:
-- nome da peça, quantidade, cor, material, preço unitário e total. Custos, composição e lucro nunca saem (D17).
alter table public.projetotrid_quotes
  add column if not exists share_token uuid unique,
  add column if not exists client_response text check (client_response in ('aprovado', 'ajuste')),
  add column if not exists client_response_at timestamptz,
  add column if not exists client_note text not null default '' check (char_length(client_note) <= 500);

create or replace function public.projetotrid_quote_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', q.title,
    'client_name', split_part(btrim(q.client_name), ' ', 1),
    'created_at', q.created_at,
    'status', q.status,
    'client_response', q.client_response,
    'client_response_at', q.client_response_at,
    'subtotal', q.subtotal,
    'discount_amount', q.discount_amount,
    'total', q.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product', left(coalesce(nullif(btrim(it->'data'->>'product'), ''), 'Peça impressa em 3D'), 120),
        'quantity', coalesce((it->'result'->>'q')::int, (it->'data'->>'quantity')::int, 1),
        'material', left(case when it->'data'->>'filamentType' = 'Outro tipo (especificar)' then coalesce(it->'data'->>'customFilament', '') else coalesce(it->'data'->>'filamentType', '') end, 80),
        'color', left(coalesce(it->'data'->>'filamentColor', ''), 40),
        'unit_price', round(coalesce((it->'result'->>'unitPrice')::numeric, 0), 2)
      ) order by ord)
      from jsonb_array_elements(q.items) with ordinality as e(it, ord)
    ), '[]'::jsonb)
  )
  from public.projetotrid_quotes q
  where p_token is not null and q.share_token = p_token;
$$;

create or replace function public.projetotrid_quote_respond(p_token uuid, p_decision text, p_note text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if p_token is null or p_decision not in ('aprovado', 'ajuste') then
    raise exception 'pedido inválido' using errcode = '22023';
  end if;
  update public.projetotrid_quotes q
     set client_response = p_decision,
         client_response_at = now(),
         client_note = left(coalesce(p_note, ''), 500),
         status = case when p_decision = 'aprovado' then 'aprovado' else q.status end,
         status_at = case when p_decision = 'aprovado' then now() else q.status_at end
   where q.share_token = p_token and q.status = 'orcado'
  returning q.status into v_status;
  if v_status is null then
    raise exception 'orçamento não encontrado ou já respondido' using errcode = 'P0002';
  end if;
  return v_status;
end $$;

revoke all on function public.projetotrid_quote_public(uuid) from public;
revoke all on function public.projetotrid_quote_respond(uuid, text, text) from public;
grant execute on function public.projetotrid_quote_public(uuid) to anon, authenticated;
grant execute on function public.projetotrid_quote_respond(uuid, text, text) to anon, authenticated;

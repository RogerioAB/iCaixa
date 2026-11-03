-- Restaurantes cuja comanda de papel não tem número impresso: o iCaixa gera um número
-- no fechamento, e é ele que vai no QR de saída.

alter table public.restaurantes add column comanda_com_numero boolean not null default true;
update public.restaurantes set comanda_com_numero = false where slug = 'seurestaurante';

create sequence public.numero_gerado_seq;

-- Usada só pela Edge Function fechar-comanda (service role).
create or replace function public.proximo_numero() returns text
language sql volatile security definer set search_path = public as $$
  select lpad(((nextval('public.numero_gerado_seq') - 1) % 9999999 + 1)::text, 7, '0')
$$;
revoke all on function public.proximo_numero() from public, anon, authenticated;

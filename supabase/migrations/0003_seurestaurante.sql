-- Restaurante de demonstração pedido em 03/11/2026, com a comanda modelo "SEU RESTAURANTE".
-- O logo é servido pelo próprio app (public/restaurantes/).

alter table public.restaurantes drop constraint slug_reservado;
alter table public.restaurantes add constraint slug_reservado
  check (slug not in ('admin', 'portaria', 'c', 'comanda', 'm', 'assets', 'icons', 'api', 'restaurantes'));

insert into public.restaurantes (slug, nome, site, logo_url)
values ('seurestaurante', 'SeuRestaurante', 'https://www.seurestaurante.com.br', '/restaurantes/seurestaurante.png')
on conflict (slug) do nothing;

-- Preços tirados da comanda modelo (1 cerveja lata = 10,00; 2 sucos = 22,00). Os demais itens
-- da grade entram pela tela /admin quando os preços forem informados.
insert into public.produtos (restaurante_id, id, nome, linha_comanda, preco_centavos, ordem)
select r.id, p.id, p.nome, p.linha, p.preco, p.ordem
from public.restaurantes r,
  (values ('cerveja-lata', 'Cerveja lata', 'CERVEJA LATA', 1000, 20),
          ('suco', 'Suco', 'SUCO', 1100, 50)) as p (id, nome, linha, preco, ordem)
where r.slug = 'seurestaurante'
on conflict do nothing;

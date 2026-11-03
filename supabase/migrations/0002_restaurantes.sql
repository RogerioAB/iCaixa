-- iCaixa: vários restaurantes.
-- Cada restaurante tem endereço próprio (icaixa.zarpa.tech/<slug>), nome, site e logo,
-- e seus próprios preços, equipe, leituras e fechamentos.

create table public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  nome text not null check (length(trim(nome)) > 0),
  local text,
  site text,
  logo_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Endereços que já são telas do app e não podem virar restaurante.
alter table public.restaurantes add constraint slug_reservado
  check (slug not in ('admin', 'portaria', 'c', 'comanda', 'm', 'assets', 'icons', 'api'));

insert into public.restaurantes (slug, nome, local) values ('temperarte', 'Temperarte', 'Copacabana');

-- Produtos: passam a pertencer a um restaurante. O id só precisa ser único dentro dele.
alter table public.produtos add column restaurante_id uuid references public.restaurantes (id) on delete cascade;
update public.produtos set restaurante_id = (select id from public.restaurantes where slug = 'temperarte');
alter table public.produtos alter column restaurante_id set not null;
alter table public.produtos drop constraint produtos_pkey;
alter table public.produtos add primary key (restaurante_id, id);

-- Equipe: portaria pertence a um restaurante. Admin sem restaurante administra todos.
alter table public.equipe add column restaurante_id uuid references public.restaurantes (id) on delete cascade;
alter table public.equipe add constraint portaria_tem_restaurante check (papel = 'admin' or restaurante_id is not null);

alter table public.leituras add column restaurante_id uuid references public.restaurantes (id);
update public.leituras set restaurante_id = (select id from public.restaurantes where slug = 'temperarte');
alter table public.leituras alter column restaurante_id set not null;

alter table public.fechamentos add column restaurante_id uuid references public.restaurantes (id);
update public.fechamentos set restaurante_id = (select id from public.restaurantes where slug = 'temperarte');
alter table public.fechamentos alter column restaurante_id set not null;

-- O mesmo número de comanda pode existir em restaurantes diferentes.
drop index public.fechamentos_numero_codigo;
create unique index fechamentos_numero_codigo on public.fechamentos (restaurante_id, numero, codigo) where codigo is not null;

-- Restaurante de quem está logado (null para o admin geral).
create or replace function public.meu_restaurante() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurante_id from public.equipe where user_id = auth.uid()
$$;

-- Admin geral: papel admin sem restaurante.
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and papel = 'admin' and restaurante_id is null)
$$;

alter table public.restaurantes enable row level security;

-- Nome, site e logo são públicos (aparecem para o cliente); só o admin altera.
create policy restaurantes_leitura on public.restaurantes for select using (ativo or public.eh_admin());
create policy restaurantes_admin on public.restaurantes for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Equipe vê só o próprio restaurante; admin geral vê tudo.
drop policy fechamentos_equipe on public.fechamentos;
create policy fechamentos_equipe on public.fechamentos for select to authenticated
  using (public.eh_admin() or (public.eh_equipe() and restaurante_id = public.meu_restaurante()));

drop policy leituras_equipe on public.leituras;
create policy leituras_equipe on public.leituras for select to authenticated
  using (public.eh_admin() or (public.eh_equipe() and restaurante_id = public.meu_restaurante()));

-- Logos: arquivos públicos no Storage, enviados só pelo admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy logos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.eh_admin());
create policy logos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.eh_admin());
create policy logos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.eh_admin());

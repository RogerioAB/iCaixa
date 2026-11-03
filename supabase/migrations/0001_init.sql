-- iCaixa: esquema inicial
-- O cliente não faz login: ele só fala com as Edge Functions, que usam a service role.
-- Por isso as tabelas de dinheiro ficam fechadas por RLS para o acesso anônimo.


-- Tabela de preços (bebidas). Comida, diversos e sobremesas vêm pela etiqueta da balança.
-- linha_comanda = o nome impresso na grade BEBIDAS da comanda; a IA usa para ler as marcações.
create table public.produtos (
  id text primary key,
  nome text not null,
  linha_comanda text,
  preco_centavos integer not null check (preco_centavos > 0),
  categoria text not null default 'bebida',
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- Quem trabalha no restaurante (portaria e administração).
create table public.equipe (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null default 'portaria' check (papel in ('portaria', 'admin')),
  criado_em timestamptz not null default now()
);

-- Cada foto de comanda lida pela IA (Edge Function ler-comanda).
create table public.leituras (
  id uuid primary key default gen_random_uuid(),
  numero_lido char(7),
  extracao jsonb not null,
  itens jsonb not null,
  total_centavos integer not null,
  avisos jsonb not null default '[]',
  mesa text,
  ip text,
  criado_em timestamptz not null default now()
);
create index leituras_ip_criado on public.leituras (ip, criado_em desc);

-- Cada vez que um cliente fecha a comanda pelo app.
create table public.fechamentos (
  id uuid primary key default gen_random_uuid(),
  numero char(7) not null check (numero ~ '^[0-9]{7}$'),
  numero_lido char(7),
  leitura_id uuid references public.leituras (id),
  mesa text,
  itens jsonb not null,
  avisos jsonb not null default '[]',
  total_centavos integer not null check (total_centavos > 0),
  metodo text not null check (metodo in ('pix', 'cartao')),
  provedor text not null,
  provedor_ref text,
  cobranca jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  codigo char(6),
  pago_em timestamptz,
  usado_em timestamptz,
  usado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  constraint codigo_quando_pago check (status <> 'pago' or codigo is not null)
);

create unique index fechamentos_numero_codigo on public.fechamentos (numero, codigo) where codigo is not null;
create index fechamentos_pago_em on public.fechamentos (pago_em desc) where status = 'pago';
create index fechamentos_provedor_ref on public.fechamentos (provedor_ref);

create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid())
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and papel = 'admin')
$$;

alter table public.produtos enable row level security;
alter table public.equipe enable row level security;
alter table public.fechamentos enable row level security;
alter table public.leituras enable row level security;

-- Preços: qualquer um lê os ativos (o app do cliente mostra a lista); só admin altera.
create policy produtos_leitura on public.produtos for select using (ativo or public.eh_admin());
create policy produtos_admin on public.produtos for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Equipe: cada um vê o próprio cadastro; admin vê todos.
create policy equipe_leitura on public.equipe for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- Fechamentos: só a equipe lê (lista da portaria). Escrita só pelas Edge Functions.
create policy fechamentos_equipe on public.fechamentos for select to authenticated
  using (public.eh_equipe());

-- Leituras: só a equipe lê (auditoria). Escrita só pela Edge Function.
create policy leituras_equipe on public.leituras for select to authenticated
  using (public.eh_equipe());

-- Preços informados pelo restaurante em 03/11/2026.
insert into public.produtos (id, nome, linha_comanda, preco_centavos, ordem) values
  ('refrigerante',  'Refrigerante (lata 350 ml)', 'Refrigerante',        800, 10),
  ('agua',          'Água mineral',               'Água',                600, 20),
  ('mate',          'Mate Leão',                  'Mate Leão',           700, 30),
  ('suco-laranja-limao', 'Suco de laranja ou limão', 'Suco Laranja/Limão', 1200, 40),
  ('suco-fruta',    'Suco de fruta (polpa)',      'Suco de Fruta',      1200, 60),
  ('suco-mix',      'Suco mix (2 frutas)',        'Suco Mix',           1500, 70),
  ('cha',           'Chá artesanal',              'Chá Artesanal',      1400, 80),
  ('taca-vinho',    'Taça de vinho 200 ml',       'Taça Vinho 200 ml',  2500, 90),
  ('vinho-tinto',   'Garrafa de vinho tinto',     'Gr. Vinho Tinto',   12000, 100),
  ('vinho-branco',  'Garrafa de vinho branco',    'Gr. Vinho Branco',   9500, 110),
  ('caipirinha',    'Caipirinha',                 'Caipirinha',         2000, 120),
  ('caipivodka',    'Caipivodka',                 'Caipivodka',         2500, 130),
  ('cafe',          'Café espresso',              'Café Expresso',       700, 140);

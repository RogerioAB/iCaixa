# iCaixa

Pagamento da comanda na própria mesa. O cliente lê o QR Code da mesa e fotografa a comanda. A IA lê o número, as etiquetas da balança (comida, diversos e sobremesa) e as bebidas marcadas pelo garçom, e o app mostra o total. O cliente confere o número e paga. Ele recebe então um QR de validação, que a portaria lê para liberar a saída. Não precisa instalar app nem fazer cadastro.

## Stack

A mesma do MyCellar: React + Vite + TypeScript + Tailwind v4 (PWA) e Supabase (Postgres, Auth e Edge Functions). O deploy é feito com Docker + Nginx no Coolify.

## Como funciona

| Rota | Quem usa | O que faz |
| --- | --- | --- |
| `/m/<mesa>` | cliente (link do QR da mesa) | fotografa a comanda, confere e fecha |
| `/c/<id>` | cliente | pagamento e QR de validação |
| `/portaria` | equipe (login) | lê o QR, confere e confirma a saída |

Edge Functions (`supabase/functions`):

- `ler-comanda` (pública): manda a foto para o Claude (`claude-opus-5-5`, saída em JSON Schema) e monta a conta com os preços do banco. A leitura fica gravada na tabela `leituras`. Há um limite de 20 leituras a cada 10 minutos por IP.
- `fechar-comanda` (pública): fecha a conta **da leitura gravada** (o celular só confirma o número e o método) e cria a cobrança.
- `status-fechamento` (pública): o celular do cliente consulta se o pagamento foi confirmado.
- `confirmar-simulado` (pública, só com `PAGAMENTO_PROVEDOR=simulado`): o botão "Simular pagamento aprovado".
- `validar-saida` (login da equipe): valida o código e registra a saída. Cada código vale uma única saída.

As regras de negócio ficam em `supabase/functions/_shared/`: `comanda.ts` (etiqueta, número, QR) e `leitura.ts` (prompt, schema e a conta montada a partir do que a IA leu). Ambos são cobertos por `npm test`.

### Leitura da comanda

- **Etiquetas:** vale o código de barras (com o dígito verificador conferido). Se ele estiver ilegível, entra o TOTAL impresso, com um aviso para a portaria.
- **Bebidas:** cada célula marcada na grade vale 1 unidade. Se o garçom escrever um número, vale o número. O preço vem sempre da tabela `produtos`, nunca da IA. A coluna `linha_comanda` diz qual linha impressa corresponde a cada produto.
- **Avisos:** dúvidas da leitura (marca ambígua, sabor do suco não indicado, texto à mão) aparecem para o cliente e para a portaria.

### Etiqueta da balança

EAN-13 começando com `2`, com o valor em centavos nos dígitos 8 a 12. Exemplo: `2000000021935` = R$ 21,93. O app confere o dígito verificador.

### Pagamento

Por enquanto o pagamento é **simulado**: nenhum valor é cobrado. A interface `ProvedorPagamento` (`_shared/pagamento.ts`) é o ponto de troca. Na fase do Asaas:

1. Crie um `AsaasProvedor` implementando `criarCobranca` (Pix com QR dinâmico e cartão pela página do Asaas).
2. Crie a Edge Function `asaas-webhook`, que chama `confirmarPagamento` (`_shared/fechamento.ts`) quando o Asaas avisar que o pagamento caiu.
3. Configure `PAGAMENTO_PROVEDOR=asaas` e `ASAAS_API_KEY` como secrets.

## Setup local

```bash
npm install
cp .env.example .env   # URL e chave anon do projeto Supabase "iCaixa"
npm run dev
npm test               # regras de negócio
```

## Supabase

```bash
npx supabase login
npx supabase link --project-ref <project-ref-do-iCaixa>
npx supabase db push                          # cria tabelas, RLS e preços
npx supabase secrets set PAGAMENTO_PROVEDOR=simulado ANTHROPIC_API_KEY=<sua chave>
npx supabase functions deploy ler-comanda fechar-comanda status-fechamento confirmar-simulado validar-saida
```

**Usuário da portaria:** crie o usuário em Authentication → Users (e-mail e senha). Depois cadastre-o na equipe pelo SQL Editor:

```sql
insert into public.equipe (user_id, nome, papel)
select id, 'Portaria', 'portaria' from auth.users where email = 'portaria@exemplo.com';
```

**Preços:** ficam na tabela `produtos`. Para mudar um preço:

```sql
update public.produtos set preco_centavos = 2500 where id = 'taca-vinho';
```

## Deploy (Coolify)

1. No Coolify, crie um app a partir deste repositório com build pack **Dockerfile**.
2. Em Build Variables, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Elas são de build, porque o Vite as embute no bundle.
3. Em Domains, use `https://icaixa.zarpa.tech`. O DNS precisa de um registro A `icaixa` apontando para o IP da VPS. O Coolify emite o HTTPS, e o HTTPS é obrigatório para a câmera funcionar no celular.
4. O QR Code de cada mesa aponta para `https://icaixa.zarpa.tech/m/<número da mesa>`.

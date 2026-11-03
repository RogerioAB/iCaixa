// Leitura da comanda pela foto: o formato que a IA devolve e a conta montada a partir dele.
// Puro (sem Deno nem navegador), coberto por tests/leitura.test.ts.

import { lerEtiqueta, normalizarNumero, type ItemConta } from './comanda.ts'

export type ProdutoComanda = { id: string; nome: string; preco_centavos: number; linha_comanda: string | null }

/** O que a IA extrai da foto (validado pelo JSON Schema abaixo). */
export type Extracao = {
  foto_legivel: boolean
  numero_comanda: string | null
  etiquetas: { codigo_barras: string | null; total_impresso_centavos: number | null; descricao: string | null }[]
  bebidas: { produto_id: string; quantidade: number }[]
  anotacoes: string[]
}

export function schemaExtracao(idsProdutos: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['foto_legivel', 'numero_comanda', 'etiquetas', 'bebidas', 'anotacoes'],
    properties: {
      foto_legivel: { type: 'boolean' },
      numero_comanda: { type: ['string', 'null'] },
      etiquetas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['codigo_barras', 'total_impresso_centavos', 'descricao'],
          properties: {
            codigo_barras: { type: ['string', 'null'] },
            total_impresso_centavos: { type: ['integer', 'null'] },
            descricao: { type: ['string', 'null'] },
          },
        },
      },
      bebidas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['produto_id', 'quantidade'],
          properties: {
            produto_id: { type: 'string', enum: idsProdutos },
            quantidade: { type: 'integer' },
          },
        },
      },
      anotacoes: { type: 'array', items: { type: 'string' } },
    },
  }
}

export function promptLeitura(produtos: ProdutoComanda[]): string {
  const linhas = produtos
    .filter((p) => p.linha_comanda)
    .map((p) => `- linha "${p.linha_comanda}" -> produto_id "${p.id}" (${p.nome})`)
    .join('\n')
  return `Esta é a foto de uma comanda individual de restaurante. Extraia os dados para fechar a conta do cliente.

Como a comanda é:
- No topo, à direita, há o número da comanda com 7 dígitos (ex.: 0000992). Os primeiros dígitos às vezes saem falhados; devolva só os dígitos que conseguir ler com segurança, sem inventar.
- Etiquetas adesivas da balança (comida, "DIVERSOS", sobremesa) podem estar coladas em qualquer lugar. Cada uma tem "TOTAL R$" impresso e um código de barras com 13 dígitos impressos embaixo, começando com 2. Para cada etiqueta, devolva os 13 dígitos exatamente como impressos (null se não der para ler todos) e o TOTAL impresso em centavos (R$ 21,93 -> 2193).
- A grade "BEBIDAS" tem uma linha por bebida e várias colunas. O garçom faz um risco para cada unidade pedida; ele não escreve números. Conte os riscos de cada linha: cada risco vale 1 unidade. Ignore linhas sem risco.
- Linhas da grade e o produto_id de cada uma:
${linhas}
- Se algo estiver escrito à mão numa linha em branco da grade ou no quadro SOBREMESAS, não converta em produto: copie o texto em anotacoes.

Regras:
- Não invente nada. Se a foto estiver cortada, borrada ou não for uma comanda, marque foto_legivel = false e explique em anotacoes.
- Se um risco for ambíguo (ex.: pode ser sujeira ou um risco cortado), conte-o e descreva a dúvida em anotacoes.`
}

export type ContaLida = {
  numero_lido: string | null
  itens: ItemConta[]
  total_centavos: number
  avisos: string[]
}

/** Monta a conta a partir da extração, com os preços do banco. Nunca confia em preços vindos da IA. */
export function montarContaDaLeitura(ex: Extracao, produtos: ProdutoComanda[]): ContaLida {
  const avisos = [...(ex.anotacoes ?? [])]
  const itens: ItemConta[] = []

  ex.etiquetas.forEach((et, i) => {
    const n = i + 1
    const lida = et.codigo_barras ? lerEtiqueta(et.codigo_barras.replace(/\D/g, '')) : null
    if (lida && !('erro' in lida)) {
      if (et.total_impresso_centavos != null && et.total_impresso_centavos !== lida.centavos) {
        avisos.push(`Etiqueta ${n}: o código de barras e o total impresso não batem. Confira na portaria.`)
      }
      itens.push({ descricao: `Etiqueta ${n}${et.descricao ? ` (${et.descricao})` : ''}`, centavos: lida.centavos, tipo: 'etiqueta', ref: lida.codigo, qtd: 1 })
    } else if (et.total_impresso_centavos != null && et.total_impresso_centavos > 0) {
      avisos.push(`Etiqueta ${n}: código de barras ilegível, valor lido do total impresso. Confira na portaria.`)
      itens.push({ descricao: `Etiqueta ${n}${et.descricao ? ` (${et.descricao})` : ''}`, centavos: et.total_impresso_centavos, tipo: 'etiqueta', ref: 'total-impresso', qtd: 1 })
    } else {
      avisos.push(`Etiqueta ${n}: não consegui ler o valor. Fotografe de novo, mais perto.`)
    }
  })

  const porId = new Map(produtos.map((p) => [p.id, p]))
  const qtds = new Map<string, number>()
  for (const b of ex.bebidas) {
    if (!porId.has(b.produto_id) || !Number.isInteger(b.quantidade) || b.quantidade <= 0) continue
    qtds.set(b.produto_id, (qtds.get(b.produto_id) ?? 0) + Math.min(b.quantidade, 50))
  }
  for (const p of produtos) {
    const q = qtds.get(p.id)
    if (q) itens.push({ descricao: `${q}× ${p.nome}`, centavos: q * p.preco_centavos, tipo: 'produto', ref: p.id, qtd: q })
  }

  const numeroDigitos = (ex.numero_comanda ?? '').replace(/\D/g, '')
  return {
    numero_lido: normalizarNumero(numeroDigitos),
    itens,
    total_centavos: itens.reduce((s, it) => s + it.centavos, 0),
    avisos,
  }
}

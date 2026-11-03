// Regras de negócio puras, sem APIs do Deno nem do navegador.
// Usadas pelas Edge Functions e também importadas pelo front-end (src/lib/comanda.ts),
// para que a conta feita no celular e a feita no servidor sejam sempre a mesma.

/** Confere o dígito verificador de um EAN-13. */
export function ean13Valido(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false
  let soma = 0
  for (let i = 0; i < 12; i++) soma += Number(codigo[i]) * (i % 2 ? 3 : 1)
  return (10 - (soma % 10)) % 10 === Number(codigo[12])
}

export type Etiqueta = { codigo: string; centavos: number }
export type ErroEtiqueta = { erro: string }

/**
 * Lê a etiqueta da balança: EAN-13 começando com 2, com o valor em centavos nos
 * dígitos 8 a 12. Ex.: 2000000021935 -> "02193" -> R$ 21,93.
 * O formato exato depende da configuração da balança; ajuste aqui se mudar.
 */
export function lerEtiqueta(codigo: string): Etiqueta | ErroEtiqueta {
  const c = codigo.trim()
  if (!ean13Valido(c)) return { erro: 'Código inválido: o dígito verificador não confere.' }
  if (c[0] !== '2') return { erro: 'Esse código não é de etiqueta de balança.' }
  const centavos = Number.parseInt(c.slice(7, 12), 10)
  if (!(centavos > 0)) return { erro: 'A etiqueta não tem valor.' }
  return { codigo: c, centavos }
}

/**
 * Normaliza o número da comanda para 7 dígitos. Os zeros à esquerda costumam sair
 * falhados na impressão, então o cliente pode digitar só "992" -> "0000992".
 * Devolve null se não houver nenhum dígito diferente de zero.
 */
export function normalizarNumero(entrada: string): string | null {
  const d = (entrada ?? '').replace(/\D/g, '')
  if (d.length === 0 || d.length > 7 || !/[1-9]/.test(d)) return null
  return d.padStart(7, '0')
}

export type Produto = { id: string; nome: string; preco_centavos: number }
export type ItemConta = { descricao: string; centavos: number; tipo: 'etiqueta' | 'produto'; ref: string; qtd: number }

export type PedidoFechamento = {
  numero: string
  etiquetas: string[]
  bebidas: Record<string, number>
}

/**
 * Monta a conta a partir do que o cliente informou e da tabela de preços.
 * O servidor sempre recalcula com esta função: o total enviado pelo celular é ignorado.
 */
export function montarConta(
  pedido: PedidoFechamento,
  produtos: Produto[],
): { numero: string; itens: ItemConta[]; total_centavos: number } | ErroEtiqueta {
  const numero = normalizarNumero(pedido.numero)
  if (!numero) return { erro: 'Número da comanda inválido.' }
  if (!Array.isArray(pedido.etiquetas) || pedido.etiquetas.length > 30) return { erro: 'Etiquetas inválidas.' }

  const itens: ItemConta[] = []
  for (const [i, cod] of pedido.etiquetas.entries()) {
    const e = lerEtiqueta(String(cod))
    if ('erro' in e) return { erro: `Etiqueta ${i + 1}: ${e.erro}` }
    itens.push({ descricao: `Etiqueta ${i + 1} (balança)`, centavos: e.centavos, tipo: 'etiqueta', ref: e.codigo, qtd: 1 })
  }

  const porId = new Map(produtos.map((p) => [p.id, p]))
  for (const [id, qtdBruta] of Object.entries(pedido.bebidas ?? {})) {
    const qtd = Number(qtdBruta)
    if (qtd === 0) continue
    if (!Number.isInteger(qtd) || qtd < 0 || qtd > 50) return { erro: 'Quantidade inválida.' }
    const p = porId.get(id)
    if (!p) return { erro: `Produto desconhecido: ${id}` }
    itens.push({ descricao: `${qtd}× ${p.nome}`, centavos: qtd * p.preco_centavos, tipo: 'produto', ref: id, qtd })
  }

  const total_centavos = itens.reduce((s, it) => s + it.centavos, 0)
  if (total_centavos <= 0) return { erro: 'A conta está vazia.' }
  return { numero, itens, total_centavos }
}

/** Código de validação curto, sem letras ambíguas (0/O, 1/I). */
export function gerarCodigo(bytes: Uint8Array): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(bytes.slice(0, 6), (b) => A[b % A.length]).join('')
}

/** Conteúdo do QR de validação mostrado ao cliente e lido na portaria. */
export function textoQrValidacao(numero: string, codigo: string): string {
  return `ICAIXA:${numero}:${codigo}`
}

export function lerQrValidacao(texto: string): { numero: string; codigo: string } | null {
  const m = /^ICAIXA:(\d{7}):([A-Z0-9]{6})$/.exec(texto.trim())
  return m ? { numero: m[1], codigo: m[2] } : null
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

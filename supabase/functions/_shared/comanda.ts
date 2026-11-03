// Regras de negócio puras, sem APIs do Deno nem do navegador.
// Usadas pelas Edge Functions e também importadas pelo front-end (src/lib/comanda.ts).

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

export type ItemConta = { descricao: string; centavos: number; tipo: 'etiqueta' | 'produto'; ref: string; qtd: number }

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

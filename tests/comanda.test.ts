import { describe, expect, it } from 'vitest'
import { ean13Valido, gerarCodigo, lerEtiqueta, lerQrValidacao, normalizarNumero, textoQrValidacao } from '../supabase/functions/_shared/comanda'

describe('etiqueta da balança', () => {
  it('lê o valor da etiqueta da foto (R$ 21,93)', () => {
    expect(ean13Valido('2000000021935')).toBe(true)
    expect(lerEtiqueta('2000000021935')).toEqual({ codigo: '2000000021935', centavos: 2193 })
  })
  it('recusa dígito verificador errado e código que não é de balança', () => {
    expect(lerEtiqueta('2000000021936')).toHaveProperty('erro')
    expect(lerEtiqueta('7891000100103')).toHaveProperty('erro')
  })
})

describe('número da comanda', () => {
  it('completa os zeros que saem falhados na impressão', () => {
    expect(normalizarNumero('992')).toBe('0000992')
    expect(normalizarNumero('0000992')).toBe('0000992')
  })
  it('recusa vazio, só zeros e mais de 7 dígitos', () => {
    expect(normalizarNumero('')).toBeNull()
    expect(normalizarNumero('0000')).toBeNull()
    expect(normalizarNumero('12345678')).toBeNull()
  })
})

describe('QR de validação', () => {
  it('ida e volta', () => {
    const codigo = gerarCodigo(new Uint8Array([0, 1, 2, 3, 4, 31]))
    expect(codigo).toMatch(/^[A-Z2-9]{6}$/)
    expect(lerQrValidacao(textoQrValidacao('0000992', codigo))).toEqual({ numero: '0000992', codigo })
    expect(lerQrValidacao('outra coisa')).toBeNull()
  })
})

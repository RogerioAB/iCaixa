import { describe, expect, it } from 'vitest'
import { gerarSlug } from '../src/lib/restaurantes'

describe('gerarSlug', () => {
  it('tira acentos, espaços e símbolos', () => {
    expect(gerarSlug('Bar do Zé & Cia.')).toBe('bar-do-ze-cia')
    expect(gerarSlug('  Temperarte ')).toBe('temperarte')
    expect(gerarSlug('Açaí da Praça 2')).toBe('acai-da-praca-2')
  })
})

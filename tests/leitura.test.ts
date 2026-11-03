import { describe, expect, it } from 'vitest'
import { montarContaDaLeitura, promptLeitura, schemaExtracao, type Extracao } from '../supabase/functions/_shared/leitura'

const produtos = [
  { id: 'agua', nome: 'Água mineral', preco_centavos: 600, linha_comanda: 'Água' },
  { id: 'suco-laranja', nome: 'Suco de laranja', preco_centavos: 1200, linha_comanda: 'Suco Laranja/Limão' },
  { id: 'caipirinha', nome: 'Caipirinha', preco_centavos: 2000, linha_comanda: 'Caipirinha' },
]

const base: Extracao = { foto_legivel: true, numero_comanda: '992', etiquetas: [], bebidas: [], anotacoes: [] }

describe('montarContaDaLeitura', () => {
  it('a comanda da foto: etiqueta de R$ 21,93 e uma água', () => {
    const c = montarContaDaLeitura(
      { ...base, etiquetas: [{ codigo_barras: '2000000021935', total_impresso_centavos: 2193, descricao: 'DIVERSOS' }], bebidas: [{ produto_id: 'agua', quantidade: 1 }] },
      produtos,
    )
    expect(c.numero_lido).toBe('0000992')
    expect(c.total_centavos).toBe(2193 + 600)
    expect(c.avisos).toEqual([])
  })

  it('usa o preço do banco, soma linhas repetidas e ignora quantidades inválidas', () => {
    const c = montarContaDaLeitura(
      { ...base, bebidas: [{ produto_id: 'caipirinha', quantidade: 1 }, { produto_id: 'caipirinha', quantidade: 2 }, { produto_id: 'agua', quantidade: -1 }, { produto_id: 'nao-existe', quantidade: 1 }] },
      produtos,
    )
    expect(c.itens).toEqual([{ descricao: '3× Caipirinha', centavos: 6000, tipo: 'produto', ref: 'caipirinha', qtd: 3 }])
  })

  it('código de barras ilegível: usa o total impresso e avisa a portaria', () => {
    const c = montarContaDaLeitura({ ...base, etiquetas: [{ codigo_barras: null, total_impresso_centavos: 3450, descricao: null }] }, produtos)
    expect(c.total_centavos).toBe(3450)
    expect(c.avisos[0]).toMatch(/total impresso/)
  })

  it('avisa quando código de barras e total impresso não batem (vale o código)', () => {
    const c = montarContaDaLeitura({ ...base, etiquetas: [{ codigo_barras: '2000000021935', total_impresso_centavos: 2000, descricao: null }] }, produtos)
    expect(c.total_centavos).toBe(2193)
    expect(c.avisos[0]).toMatch(/não batem/)
  })

  it('etiqueta sem nenhum valor legível não entra na conta', () => {
    const c = montarContaDaLeitura({ ...base, etiquetas: [{ codigo_barras: '123', total_impresso_centavos: null, descricao: null }] }, produtos)
    expect(c.total_centavos).toBe(0)
    expect(c.avisos[0]).toMatch(/Fotografe de novo/)
  })

  it('número ilegível fica nulo', () => {
    expect(montarContaDaLeitura({ ...base, numero_comanda: null }, produtos).numero_lido).toBeNull()
  })
})

describe('prompt e schema', () => {
  it('listam as linhas da comanda e só aceitam produtos conhecidos', () => {
    expect(promptLeitura(produtos)).toContain('linha "Suco Laranja/Limão" -> produto_id "suco-laranja"')
    const s = schemaExtracao(produtos.map((p) => p.id)) as { properties: { bebidas: { items: { properties: { produto_id: { enum: string[] } } } } } }
    expect(s.properties.bebidas.items.properties.produto_id.enum).toEqual(['agua', 'suco-laranja', 'caipirinha'])
  })
})

import { supabase } from './supabase'

export type Restaurante = {
  id: string
  slug: string
  nome: string
  local: string | null
  site: string | null
  logo_url: string | null
  ativo: boolean
}

export type Produto = {
  restaurante_id: string
  id: string
  nome: string
  linha_comanda: string | null
  preco_centavos: number
  ordem: number
  ativo: boolean
}

const CAMPOS = 'id, slug, nome, local, site, logo_url, ativo'

/** Restaurante ativo pelo endereço (icaixa.zarpa.tech/<slug>). Público. */
export async function buscarRestaurante(slug: string): Promise<Restaurante | null> {
  const { data, error } = await supabase.from('restaurantes').select(CAMPOS).eq('slug', slug.toLowerCase()).eq('ativo', true).maybeSingle()
  if (error) throw new Error('Sem conexão. Tente de novo.')
  return data as Restaurante | null
}

export async function listarRestaurantes(): Promise<Restaurante[]> {
  const { data, error } = await supabase.from('restaurantes').select(CAMPOS).order('nome')
  if (error) throw new Error(error.message)
  return data as Restaurante[]
}

export async function salvarRestaurante(r: Omit<Restaurante, 'id'> & { id?: string }): Promise<Restaurante> {
  const { data, error } = r.id
    ? await supabase.from('restaurantes').update(r).eq('id', r.id).select(CAMPOS).single()
    : await supabase.from('restaurantes').insert(r).select(CAMPOS).single()
  if (error) {
    if (error.code === '23505') throw new Error('Esse endereço já é usado por outro restaurante.')
    if (error.code === '23514') throw new Error('Endereço inválido ou reservado. Use letras minúsculas, números e hífen.')
    throw new Error(error.message)
  }
  return data as Restaurante
}

/** Envia o logo para o Storage (bucket público "logos") e devolve a URL pública. */
export async function enviarLogo(slug: string, arquivo: File): Promise<string> {
  const ext = (arquivo.name.split('.').pop() ?? 'png').toLowerCase()
  const caminho = `${slug}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('logos').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  if (error) throw new Error('Não foi possível enviar o logo: ' + error.message)
  return supabase.storage.from('logos').getPublicUrl(caminho).data.publicUrl
}

export async function listarProdutos(restauranteId: string): Promise<Produto[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('restaurante_id, id, nome, linha_comanda, preco_centavos, ordem, ativo')
    .eq('restaurante_id', restauranteId)
    .order('ordem')
  if (error) throw new Error(error.message)
  return data as Produto[]
}

export async function salvarProduto(p: Produto): Promise<void> {
  const { error } = await supabase.from('produtos').upsert({ ...p, atualizado_em: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

export async function excluirProduto(p: Produto): Promise<void> {
  const { error } = await supabase.from('produtos').delete().eq('restaurante_id', p.restaurante_id).eq('id', p.id)
  if (error) throw new Error(error.message)
}

/** "Bar do Zé" -> "bar-do-ze" */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const enderecoPublico = (slug: string) => `${window.location.origin}/${slug}`

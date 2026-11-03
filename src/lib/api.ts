import { FunctionsHttpError } from '@supabase/supabase-js'
import type { ItemConta } from './comanda'
import { supabase } from './supabase'

export type Cobranca = { referencia: string; pixCopiaECola?: string; pixQrImagem?: string; urlPagamento?: string }

export type Fechamento = {
  id: string
  numero: string
  numero_lido?: string | null
  itens: ItemConta[]
  avisos?: string[]
  total_centavos: number
  metodo: 'pix' | 'cartao'
  provedor: string
  cobranca: Cobranca | null
  status: 'pendente' | 'pago' | 'cancelado'
  codigo: string | null
  pago_em: string | null
  usado_em: string | null
}

export type ResultadoValidacao =
  | { resultado: 'invalido' }
  | { resultado: 'nao_encontrada'; numero: string; codigo: string }
  | { resultado: 'paga' | 'ja_utilizada' | 'liberada'; fechamento: Fechamento }

/** Chama uma Edge Function e transforma o erro dela numa mensagem legível. */
async function chamar<T>(nome: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const corpo = await error.context.json().catch(() => null)
      throw new Error(corpo?.erro ?? 'Falha na comunicação com o servidor.')
    }
    throw new Error('Sem conexão. Tente de novo.')
  }
  return data as T
}

export type Leitura = {
  leitura_id: string
  numero_lido: string | null
  itens: ItemConta[]
  total_centavos: number
  avisos: string[]
}

/** Envia a foto da comanda para a IA ler (Edge Function ler-comanda). */
export const lerComanda = (imagem: string, mesa?: string) => chamar<Leitura>('ler-comanda', { imagem, tipo: 'image/jpeg', mesa })

export const fecharComanda = (pedido: { leitura_id: string; numero: string; metodo: 'pix' | 'cartao' }) =>
  chamar<{ id: string }>('fechar-comanda', pedido)

export const statusFechamento = (id: string) => chamar<Fechamento>('status-fechamento', { id })

export const confirmarSimulado = (id: string) => chamar<Fechamento>('confirmar-simulado', { id })

export const validarSaida = (numero: string, codigo: string, confirmar = false) =>
  chamar<ResultadoValidacao>('validar-saida', { numero, codigo, confirmar })

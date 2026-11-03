import type { SupabaseClient } from '@supabase/supabase-js'
import { gerarCodigo } from './comanda.ts'

/**
 * Marca o fechamento como pago e gera o código de validação de uso único.
 * Chamado pelo `confirmar-simulado` hoje e pelo `asaas-webhook` na fase do Asaas.
 * Idempotente: se já estiver pago, devolve o código existente.
 */
export async function confirmarPagamento(db: SupabaseClient, fechamentoId: string) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo(crypto.getRandomValues(new Uint8Array(6)))
    const { data, error } = await db
      .from('fechamentos')
      .update({ status: 'pago', codigo, pago_em: new Date().toISOString() })
      .eq('id', fechamentoId)
      .eq('status', 'pendente')
      .select('id, numero, codigo, total_centavos, status')
      .maybeSingle()
    // 23505 = código repetido para a mesma comanda (índice único): tenta outro.
    if (error?.code === '23505') continue
    if (error) throw error
    if (data) return data
    break
  }
  const { data, error } = await db
    .from('fechamentos')
    .select('id, numero, codigo, total_centavos, status')
    .eq('id', fechamentoId)
    .maybeSingle()
  if (error) throw error
  return data
}

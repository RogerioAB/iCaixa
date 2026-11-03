// Só para a fase sem Asaas: o botão "Simular pagamento aprovado" chama esta função.
// Quando PAGAMENTO_PROVEDOR for outro provedor, ela recusa, e quem confirma é o webhook.

import { confirmarPagamento } from '../_shared/fechamento.ts'
import { adminClient, json, lerPost } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body
  if ((Deno.env.get('PAGAMENTO_PROVEDOR') ?? 'simulado') !== 'simulado') {
    return json({ erro: 'Pagamento simulado desativado.' }, 403)
  }
  const id = String(body.id ?? '')
  const db = adminClient()
  const { data: f } = await db.from('fechamentos').select('provedor').eq('id', id).maybeSingle()
  if (!f || f.provedor !== 'simulado') return json({ erro: 'Comanda não encontrada.' }, 404)

  try {
    const r = await confirmarPagamento(db, id)
    if (!r || r.status !== 'pago') return json({ erro: 'Esta comanda não pode mais ser paga.' }, 409)
    return json(r)
  } catch (e) {
    console.error(e)
    return json({ erro: 'Falha ao confirmar o pagamento.' }, 500)
  }
})

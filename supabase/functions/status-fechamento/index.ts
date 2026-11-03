// Público: o celular do cliente consulta se o pagamento já foi confirmado.
// O id do fechamento é um UUID aleatório, conhecido só por quem fechou a comanda.

import { adminClient, json, lerPost } from '../_shared/http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body
  const id = String(body.id ?? '')
  if (!UUID.test(id)) return json({ erro: 'Comanda não encontrada.' }, 404)

  const { data, error } = await adminClient()
    .from('fechamentos')
    .select('id, numero, itens, total_centavos, metodo, provedor, cobranca, status, codigo, pago_em, usado_em')
    .eq('id', id)
    .maybeSingle()
  if (error) return json({ erro: 'Falha ao consultar.' }, 500)
  if (!data) return json({ erro: 'Comanda não encontrada.' }, 404)
  if (data.status !== 'pago') data.codigo = null
  return json(data)
})

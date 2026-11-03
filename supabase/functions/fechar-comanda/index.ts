// Público (sem login): fecha a conta de uma leitura já feita (ler-comanda) e cria a cobrança.
// A conta vem da leitura gravada no banco; o celular só confirma o número da comanda e o método.

import { normalizarNumero } from '../_shared/comanda.ts'
import { adminClient, json, lerPost } from '../_shared/http.ts'
import { escolherProvedor, type MetodoPagamento } from '../_shared/pagamento.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALIDADE_LEITURA_MS = 30 * 60 * 1000

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body

  const metodo = body.metodo === 'cartao' ? 'cartao' : body.metodo === 'pix' ? 'pix' : null
  if (!metodo) return json({ erro: 'Escolha Pix ou cartão.' }, 400)
  const numero = normalizarNumero(String(body.numero ?? ''))
  if (!numero) return json({ erro: 'Confira o número da comanda.' }, 400)
  const leituraId = String(body.leitura_id ?? '')
  if (!UUID.test(leituraId)) return json({ erro: 'Fotografe a comanda de novo.' }, 400)

  const db = adminClient()
  const { data: leitura } = await db
    .from('leituras')
      .select('id, restaurante_id, numero_lido, itens, total_centavos, avisos, mesa, criado_em')
    .eq('id', leituraId)
    .maybeSingle()
  if (!leitura || Date.now() - new Date(leitura.criado_em).getTime() > VALIDADE_LEITURA_MS) {
    return json({ erro: 'Esta leitura expirou. Fotografe a comanda de novo.' }, 410)
  }
  if (!(leitura.total_centavos > 0)) return json({ erro: 'Não encontrei nada para cobrar nesta comanda.' }, 400)

  const avisos = [...(leitura.avisos ?? [])]
  if (leitura.numero_lido && leitura.numero_lido !== numero) {
    avisos.push(`Número informado pelo cliente (${numero}) diferente do lido na foto (${leitura.numero_lido}).`)
  }

  const provedor = escolherProvedor(Deno.env.get('PAGAMENTO_PROVEDOR'))
  const { data: fechamento, error } = await db
    .from('fechamentos')
    .insert({
      restaurante_id: leitura.restaurante_id,
      numero,
      numero_lido: leitura.numero_lido,
      leitura_id: leitura.id,
      mesa: leitura.mesa,
      itens: leitura.itens,
      avisos,
      total_centavos: leitura.total_centavos,
      metodo,
      provedor: provedor.nome,
      status: 'pendente',
    })
    .select('id')
    .single()
  if (error) return json({ erro: 'Não foi possível registrar a comanda.' }, 500)

  try {
    const cobranca = await provedor.criarCobranca({
      fechamentoId: fechamento.id,
      numero,
      totalCentavos: leitura.total_centavos,
      metodo: metodo as MetodoPagamento,
    })
    await db.from('fechamentos').update({ provedor_ref: cobranca.referencia, cobranca }).eq('id', fechamento.id)
    return json({ id: fechamento.id })
  } catch (e) {
    console.error('criarCobranca falhou', e)
    await db.from('fechamentos').update({ status: 'cancelado' }).eq('id', fechamento.id)
    return json({ erro: 'O provedor de pagamento não respondeu. Tente de novo.' }, 502)
  }
})

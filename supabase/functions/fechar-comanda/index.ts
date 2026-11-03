// Público (sem login): o cliente envia o que leu na comanda, o servidor recalcula
// a conta com os preços do banco, grava o fechamento e cria a cobrança no provedor.

import { montarConta, type Produto } from '../_shared/comanda.ts'
import { adminClient, json, lerPost } from '../_shared/http.ts'
import { escolherProvedor, type MetodoPagamento } from '../_shared/pagamento.ts'

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body

  const metodo = body.metodo === 'cartao' ? 'cartao' : body.metodo === 'pix' ? 'pix' : null
  if (!metodo) return json({ erro: 'Escolha Pix ou cartão.' }, 400)

  const db = adminClient()
  const { data: produtos, error: errProdutos } = await db
    .from('produtos')
    .select('id, nome, preco_centavos')
    .eq('ativo', true)
  if (errProdutos) return json({ erro: 'Não foi possível carregar os preços.' }, 500)

  const conta = montarConta(
    {
      numero: String(body.numero ?? ''),
      etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas.map(String) : [],
      bebidas: (body.bebidas && typeof body.bebidas === 'object' ? body.bebidas : {}) as Record<string, number>,
    },
    (produtos ?? []) as Produto[],
  )
  if ('erro' in conta) return json({ erro: conta.erro }, 400)

  const provedor = escolherProvedor(Deno.env.get('PAGAMENTO_PROVEDOR'))
  const mesa = typeof body.mesa === 'string' ? body.mesa.slice(0, 20) : null

  const { data: fechamento, error } = await db
    .from('fechamentos')
    .insert({
      numero: conta.numero,
      mesa,
      itens: conta.itens,
      total_centavos: conta.total_centavos,
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
      numero: conta.numero,
      totalCentavos: conta.total_centavos,
      metodo: metodo as MetodoPagamento,
    })
    await db
      .from('fechamentos')
      .update({ provedor_ref: cobranca.referencia, cobranca })
      .eq('id', fechamento.id)
    return json({
      id: fechamento.id,
      numero: conta.numero,
      itens: conta.itens,
      total_centavos: conta.total_centavos,
      metodo,
      provedor: provedor.nome,
      cobranca,
    })
  } catch (e) {
    console.error('criarCobranca falhou', e)
    await db.from('fechamentos').update({ status: 'cancelado' }).eq('id', fechamento.id)
    return json({ erro: 'O provedor de pagamento não respondeu. Tente de novo.' }, 502)
  }
})

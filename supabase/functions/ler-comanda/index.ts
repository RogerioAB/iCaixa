// Público (sem login): recebe a foto da comanda, pede à IA para ler o número, as etiquetas
// da balança e as bebidas marcadas pelo garçom, e devolve a conta montada com os preços do banco.
// A leitura fica gravada: o fechamento usa a conta gravada aqui, não o que o celular mandar depois.
// ANTHROPIC_API_KEY vive só como secret desta function (`supabase secrets set`).

import Anthropic from '@anthropic-ai/sdk'
import { montarContaDaLeitura, promptLeitura, schemaExtracao, type Extracao, type ProdutoComanda } from '../_shared/leitura.ts'
import { adminClient, json, lerPost } from '../_shared/http.ts'

const MODELO = 'claude-opus-5-5'
const MAX_BYTES_IMAGEM = 5 * 1024 * 1024
const LIMITE_POR_IP_10MIN = 20

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body

  const imagem = typeof body.imagem === 'string' ? body.imagem : ''
  const tipo = body.tipo === 'image/png' ? 'image/png' : 'image/jpeg'
  if (!imagem || !/^[A-Za-z0-9+/=]+$/.test(imagem)) return json({ erro: 'Envie a foto da comanda.' }, 400)
  if (imagem.length * 0.75 > MAX_BYTES_IMAGEM) return json({ erro: 'A foto é grande demais.' }, 413)

  const db = adminClient()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

  // Cada leitura custa uma chamada à IA: limita por IP para evitar abuso.
  if (ip) {
    const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await db.from('leituras').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('criado_em', desde)
    if ((count ?? 0) >= LIMITE_POR_IP_10MIN) return json({ erro: 'Muitas leituras seguidas. Aguarde alguns minutos.' }, 429)
  }

  const { data: produtos, error: errProdutos } = await db
    .from('produtos')
    .select('id, nome, preco_centavos, linha_comanda')
    .eq('ativo', true)
    .order('ordem')
  if (errProdutos || !produtos?.length) return json({ erro: 'Não foi possível carregar os preços.' }, 500)

  let extracao: Extracao
  try {
    const resposta = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: schemaExtracao(produtos.map((p) => p.id)) },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipo, data: imagem } },
            { type: 'text', text: promptLeitura(produtos as ProdutoComanda[]) },
          ],
        },
      ],
    })
    if (resposta.stop_reason === 'refusal') return json({ erro: 'Não consegui ler esta foto. Tente outra.' }, 422)
    const texto = resposta.content.find((b) => b.type === 'text')
    if (!texto || texto.type !== 'text') throw new Error('resposta sem texto')
    extracao = JSON.parse(texto.text) as Extracao
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erro: 'Muitas leituras agora. Tente de novo em instantes.' }, 429)
    console.error('leitura falhou', e)
    return json({ erro: 'Não consegui ler a comanda agora. Tente de novo.' }, 502)
  }

  if (!extracao.foto_legivel) {
    return json({ erro: 'A foto não ficou legível.', avisos: extracao.anotacoes, ilegivel: true }, 422)
  }

  const conta = montarContaDaLeitura(extracao, produtos as ProdutoComanda[])
  const mesa = typeof body.mesa === 'string' ? body.mesa.slice(0, 20) : null

  const { data: leitura, error } = await db
    .from('leituras')
    .insert({ numero_lido: conta.numero_lido, extracao, itens: conta.itens, total_centavos: conta.total_centavos, avisos: conta.avisos, mesa, ip })
    .select('id')
    .single()
  if (error) return json({ erro: 'Não foi possível registrar a leitura.' }, 500)

  return json({ leitura_id: leitura.id, ...conta })
})

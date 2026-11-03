// Portaria (exige login de alguém da tabela `equipe`): consulta um código de validação
// e, com confirmar=true, registra a saída. Cada código vale uma única saída.

import { createClient } from '@supabase/supabase-js'
import { normalizarNumero } from '../_shared/comanda.ts'
import { adminClient, json, lerPost } from '../_shared/http.ts'

const CAMPOS = 'id, numero, itens, total_centavos, metodo, pago_em, usado_em'

Deno.serve(async (req) => {
  const body = await lerPost(req)
  if (body instanceof Response) return body

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: auth } = await userClient.auth.getUser()
  if (!auth?.user) return json({ erro: 'Faça login.' }, 401)

  const db = adminClient()
  const { data: membro } = await db.from('equipe').select('user_id').eq('user_id', auth.user.id).maybeSingle()
  if (!membro) return json({ erro: 'Seu usuário não faz parte da equipe.' }, 403)

  const numero = normalizarNumero(String(body.numero ?? ''))
  const codigo = String(body.codigo ?? '').trim().toUpperCase()
  if (!numero || !/^[A-Z0-9]{6}$/.test(codigo)) return json({ resultado: 'invalido' })

  const { data: f, error } = await db
    .from('fechamentos')
    .select(CAMPOS)
    .eq('numero', numero)
    .eq('codigo', codigo)
    .eq('status', 'pago')
    .maybeSingle()
  if (error) return json({ erro: 'Falha ao consultar.' }, 500)
  if (!f) return json({ resultado: 'nao_encontrada', numero, codigo })
  if (f.usado_em) return json({ resultado: 'ja_utilizada', fechamento: f })
  if (body.confirmar !== true) return json({ resultado: 'paga', fechamento: f })

  // Só marca se ainda não foi usada: duas leituras ao mesmo tempo não liberam duas saídas.
  const { data: usado, error: errUso } = await db
    .from('fechamentos')
    .update({ usado_em: new Date().toISOString(), usado_por: auth.user.id })
    .eq('id', f.id)
    .is('usado_em', null)
    .select(CAMPOS)
    .maybeSingle()
  if (errUso) return json({ erro: 'Falha ao registrar a saída.' }, 500)
  if (!usado) return json({ resultado: 'ja_utilizada', fechamento: f })
  return json({ resultado: 'liberada', fechamento: usado })
})

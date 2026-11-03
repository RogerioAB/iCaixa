import { createClient } from '@supabase/supabase-js'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Cliente com service role: ignora RLS. Só existe dentro das Edge Functions. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

/** Lê o corpo JSON de um POST, respondendo ao preflight de CORS. */
export async function lerPost(req: Request): Promise<Record<string, unknown> | Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object') return json({ erro: 'Corpo inválido.' }, 400)
    return body as Record<string, unknown>
  } catch {
    return json({ erro: 'Corpo inválido.' }, 400)
  }
}

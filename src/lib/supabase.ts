import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Preenchido quando o build foi feito sem as variáveis do Supabase; main.tsx mostra o aviso na tela. */
export const erroConfig =
  !supabaseUrl || !supabaseAnonKey
    ? 'O app foi publicado sem VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. No Coolify, cadastre as duas como variáveis de build e faça um novo deploy.'
    : null

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'sem-chave')

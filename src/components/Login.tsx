import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Aviso, Cartao, botaoPrimario, campo } from './ui'

export function Login({ titulo }: { titulo: string }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  async function entrar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (!error) return
    const msg = error.message.toLowerCase()
    if (msg.includes('invalid login credentials')) setErro('E-mail ou senha incorretos.')
    else if (msg.includes('not confirmed')) setErro('Este e-mail ainda não foi confirmado. No Supabase, confirme o usuário em Authentication → Users.')
    else setErro(`Não foi possível entrar: ${error.message}`)
  }
  return (
    <Cartao titulo={titulo}>
      <form className="flex flex-col gap-2" onSubmit={entrar}>
        <input id="email" className={campo} type="email" placeholder="E-mail" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input id="senha" className={campo} type="password" placeholder="Senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button className={botaoPrimario}>Entrar</button>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </form>
    </Cartao>
  )
}

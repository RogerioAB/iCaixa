import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Leitor } from '../components/Leitor'
import { Aviso, Cartao, Pagina, botao, botaoPrimario, campo } from '../components/ui'
import { validarSaida, type Fechamento, type ResultadoValidacao } from '../lib/api'
import { formatarReais, lerQrValidacao } from '../lib/comanda'
import { supabase } from '../lib/supabase'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  async function entrar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
  }
  return (
    <Cartao titulo="Portaria">
      <form className="flex flex-col gap-2" onSubmit={entrar}>
        <input id="email" className={campo} type="email" placeholder="E-mail" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input id="senha" className={campo} type="password" placeholder="Senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button className={botaoPrimario}>Entrar</button>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </form>
    </Cartao>
  )
}

function Veredito({ r, onConfirmar, confirmando }: { r: ResultadoValidacao; onConfirmar: () => void; confirmando: boolean }) {
  if (r.resultado === 'invalido')
    return <Bloco tom="erro" titulo="Código inválido" linhas={['Confira o número da comanda e o código de 6 caracteres.']} />
  if (r.resultado === 'nao_encontrada')
    return <Bloco tom="erro" titulo="Não encontrada" linhas={[`Comanda ${r.numero} com código ${r.codigo} não tem pagamento.`, 'Encaminhe o cliente ao caixa.']} />
  const f = r.fechamento
  const detalhes = [
    `Comanda ${f.numero} · ${formatarReais(f.total_centavos)} · ${f.metodo === 'pix' ? 'Pix' : 'Cartão'}${f.pago_em ? ` · ${hora(f.pago_em)}` : ''}`,
    ...f.itens.map((it) => `${it.descricao}: ${formatarReais(it.centavos)}`),
  ]
  if (r.resultado === 'ja_utilizada')
    return <Bloco tom="erro" titulo="Já utilizada" linhas={[`Saída registrada às ${f.usado_em ? hora(f.usado_em) : '?'}.`, ...detalhes]} />
  if (r.resultado === 'liberada') return <Bloco tom="ok" titulo="Saída liberada" linhas={[detalhes[0], 'Recolha a comanda de papel.']} />
  return (
    <Bloco tom="ok" titulo="Paga" linhas={[...detalhes, 'Confira os itens com a comanda de papel.']}>
      <button type="button" className={`${botao} border-emerald-700 bg-emerald-700 text-white`} disabled={confirmando} onClick={onConfirmar}>
        Confirmar saída
      </button>
    </Bloco>
  )
}

function Bloco({ tom, titulo, linhas, children }: { tom: 'ok' | 'erro'; titulo: string; linhas: string[]; children?: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 text-center ${tom === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
      <div className="text-3xl font-bold">{titulo}</div>
      {linhas.map((l, i) => (
        <div key={i} className={i === 0 ? 'font-mono' : 'text-sm'}>
          {l}
        </div>
      ))}
      {children}
    </div>
  )
}

async function buscarRecentes(): Promise<Fechamento[]> {
  const { data } = await supabase
    .from('fechamentos')
    .select('id, numero, total_centavos, metodo, pago_em, usado_em, codigo')
    .eq('status', 'pago')
    .order('pago_em', { ascending: false })
    .limit(20)
  return (data ?? []) as Fechamento[]
}

function Validador() {
  const [numero, setNumero] = useState('')
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [recentes, setRecentes] = useState<Fechamento[]>([])

  const carregarRecentes = useCallback(() => {
    void buscarRecentes().then(setRecentes)
  }, [])

  useEffect(() => {
    buscarRecentes().then(setRecentes)
  }, [])

  async function validar(n: string, c: string, confirmar = false) {
    setOcupado(true)
    setErro(null)
    try {
      setResultado(await validarSaida(n, c, confirmar))
      if (confirmar) carregarRecentes()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Cartao titulo="Validar saída">
        <Leitor
          tipo="qr"
          rotulo="Ler QR Code do cliente"
          onLido={(t) => {
            const q = lerQrValidacao(t)
            if (!q) {
              setErro('Esse QR Code não é de validação do iCaixa.')
              return
            }
            setNumero(q.numero)
            setCodigo(q.codigo)
            void validar(q.numero, q.codigo)
          }}
        />
        <form
          className="grid grid-cols-[1fr_1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void validar(numero, codigo)
          }}
        >
          <input id="p-numero" className={`${campo} font-mono`} inputMode="numeric" maxLength={7} placeholder="Comanda" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
          <input id="p-codigo" className={`${campo} font-mono uppercase`} maxLength={6} placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          <button className={botao} disabled={ocupado}>
            Validar
          </button>
        </form>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </Cartao>

      {resultado && (
        <Veredito
          r={resultado}
          confirmando={ocupado}
          onConfirmar={() => 'fechamento' in resultado && void validar(resultado.fechamento.numero, codigo, true)}
        />
      )}

      <Cartao titulo="Últimas comandas pagas">
        <ul className="flex flex-col">
          {recentes.length === 0 && <li className="text-sm text-apagado">Nenhuma comanda paga ainda.</li>}
          {recentes.map((f) => (
            <li key={f.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-dashed border-linha py-2 first:border-0">
              <div className="min-w-0 font-mono">
                {f.numero}
                <div className="text-xs text-apagado">{f.pago_em && hora(f.pago_em)}</div>
              </div>
              <div className="font-mono tabular-nums">{formatarReais(f.total_centavos)}</div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.usado_em ? 'bg-linha text-apagado' : 'bg-emerald-50 text-emerald-800'}`}>
                {f.usado_em ? 'saiu' : 'paga'}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className={botao} onClick={carregarRecentes}>
          Atualizar lista
        </button>
      </Cartao>
    </>
  )
}

export default function PortariaPage() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <Pagina>
      {sessao === undefined ? null : sessao ? (
        <>
          <Validador />
          <button type="button" className="text-sm text-apagado underline" onClick={() => void supabase.auth.signOut()}>
            Sair ({sessao.user.email})
          </button>
        </>
      ) : (
        <Login />
      )}
    </Pagina>
  )
}

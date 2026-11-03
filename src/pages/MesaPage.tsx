import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Leitor } from '../components/Leitor'
import { Aviso, Cartao, Pagina, botao, botaoPrimario, campo } from '../components/ui'
import { fecharComanda, listarProdutos } from '../lib/api'
import { formatarReais, lerEtiqueta, montarConta, normalizarNumero, type Produto } from '../lib/comanda'
import { salvarUltimo } from '../lib/ultimo'

type Msg = { tom: 'ok' | 'erro' | 'aviso'; texto: string } | null

export default function MesaPage() {
  const { mesa } = useParams()
  const navigate = useNavigate()
  const [numeroDigitado, setNumeroDigitado] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [bebidas, setBebidas] = useState<Record<string, number>>({})
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix')
  const [codManual, setCodManual] = useState('')
  const [msgEtiqueta, setMsgEtiqueta] = useState<Msg>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarProdutos()
      .then(setProdutos)
      .catch((e: Error) => setErroGeral(e.message))
  }, [])

  const numero = normalizarNumero(numeroDigitado)
  const conta = useMemo(
    () => (produtos ? montarConta({ numero: numero ?? '0000001', etiquetas, bebidas }, produtos) : null),
    [produtos, numero, etiquetas, bebidas],
  )
  const total = conta && !('erro' in conta) ? conta.total_centavos : 0

  function adicionarEtiqueta(codigo: string) {
    const e = lerEtiqueta(codigo)
    if ('erro' in e) {
      setMsgEtiqueta({ tom: 'erro', texto: e.erro })
      return false
    }
    const repetida = etiquetas.includes(e.codigo)
    setEtiquetas((atual) => [...atual, e.codigo])
    setMsgEtiqueta(
      repetida
        ? { tom: 'aviso', texto: `Etiqueta de ${formatarReais(e.centavos)} adicionada. Já havia uma igual; remova se foi lida duas vezes.` }
        : { tom: 'ok', texto: `Etiqueta de ${formatarReais(e.centavos)} adicionada.` },
    )
    return true
  }

  async function pagar() {
    if (!numero) return
    setEnviando(true)
    setErroGeral(null)
    try {
      const f = await fecharComanda({ numero, etiquetas, bebidas, metodo, mesa })
      salvarUltimo(f.id)
      navigate(`/c/${f.id}`)
    } catch (e) {
      setErroGeral((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pagina>
      {mesa && <p className="text-sm text-apagado">Mesa {mesa}</p>}

      <Cartao titulo="Comanda">
        <p className="text-sm text-apagado">
          Digite o número impresso no topo da comanda. Pode digitar só os números do final, sem os zeros (ex.: 992).
        </p>
        <input
          id="numero"
          className={`${campo} text-center font-mono text-2xl tracking-[0.12em]`}
          inputMode="numeric"
          maxLength={7}
          placeholder="992"
          autoComplete="off"
          value={numeroDigitado}
          onChange={(e) => setNumeroDigitado(e.target.value.replace(/\D/g, '').slice(0, 7))}
        />
        {numero && <Aviso tom="ok">Comanda {numero}. Confira se é o número do papel.</Aviso>}
      </Cartao>

      <Cartao titulo="Etiquetas da balança">
        <p className="text-sm text-apagado">
          Leia cada etiqueta colada na comanda (comida, diversos e sobremesa). O valor vem do código de barras.
        </p>
        <Leitor tipo="etiqueta" rotulo="Ler etiqueta" onLido={adicionarEtiqueta} />
        <div className="flex gap-2">
          <input
            id="codigo-manual"
            className={`${campo} font-mono`}
            inputMode="numeric"
            maxLength={13}
            placeholder="ou digite os 13 números"
            value={codManual}
            onChange={(e) => setCodManual(e.target.value.replace(/\D/g, ''))}
          />
          <button type="button" className={botao} onClick={() => adicionarEtiqueta(codManual) && setCodManual('')}>
            Adicionar
          </button>
        </div>
        {msgEtiqueta && <Aviso tom={msgEtiqueta.tom}>{msgEtiqueta.texto}</Aviso>}
        <ul className="flex flex-col">
          {etiquetas.length === 0 && <li className="text-sm text-apagado">Nenhuma etiqueta lida ainda.</li>}
          {etiquetas.map((cod, i) => {
            const e = lerEtiqueta(cod)
            return (
              <li key={`${cod}-${i}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-dashed border-linha py-2 first:border-0">
                <div className="min-w-0">
                  <div>Etiqueta {i + 1}</div>
                  <div className="font-mono text-xs text-apagado">{cod}</div>
                </div>
                <div className="font-mono tabular-nums">{'erro' in e ? '—' : formatarReais(e.centavos)}</div>
                <button
                  type="button"
                  aria-label={`Remover etiqueta ${i + 1}`}
                  className="size-8 rounded-full border border-linha text-apagado"
                  onClick={() => setEtiquetas((a) => a.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      </Cartao>

      <Cartao titulo="Bebidas">
        <p className="text-sm text-apagado">Informe as quantidades que o garçom marcou na comanda. A portaria confere com o papel.</p>
        {!produtos && !erroGeral && <p className="text-sm text-apagado">Carregando preços…</p>}
        <ul className="flex flex-col">
          {produtos?.map((p) => {
            const q = bebidas[p.id] ?? 0
            const mudar = (d: number) => setBebidas((b) => ({ ...b, [p.id]: Math.max(0, q + d) }))
            return (
              <li key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-dashed border-linha py-2 first:border-0">
                <div className="min-w-0">
                  <div>{p.nome}</div>
                  <div className="font-mono text-xs text-apagado">{formatarReais(p.preco_centavos)}</div>
                </div>
                <div className="font-mono tabular-nums">{q ? formatarReais(q * p.preco_centavos) : ''}</div>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label={`Menos ${p.nome}`} disabled={!q} className="size-9 rounded-full border border-linha text-lg disabled:opacity-40" onClick={() => mudar(-1)}>
                    −
                  </button>
                  <span className="w-5 text-center font-mono">{q}</span>
                  <button type="button" aria-label={`Mais ${p.nome}`} className="size-9 rounded-full border border-linha text-lg" onClick={() => mudar(1)}>
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </Cartao>

      <Cartao titulo="Forma de pagamento">
        <div className="grid grid-cols-2 gap-2">
          {(['pix', 'cartao'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metodo === m}
              className={`${botao} ${metodo === m ? 'border-vinho-600 bg-vinho-100 text-vinho-700' : ''}`}
              onClick={() => setMetodo(m)}
            >
              {m === 'pix' ? 'Pix' : 'Cartão de crédito'}
            </button>
          ))}
        </div>
      </Cartao>

      {erroGeral && <Aviso tom="erro">{erroGeral}</Aviso>}

      <div className="fixed inset-x-0 bottom-0 border-t border-linha bg-papel px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-apagado uppercase">Total</div>
            <div className="font-mono text-2xl font-semibold tabular-nums">{formatarReais(total)}</div>
          </div>
          <button type="button" className={botaoPrimario} disabled={!numero || total <= 0 || enviando} onClick={pagar}>
            {enviando ? 'Enviando…' : numero ? 'Pagar' : 'Informe a comanda'}
          </button>
        </div>
      </div>
    </Pagina>
  )
}

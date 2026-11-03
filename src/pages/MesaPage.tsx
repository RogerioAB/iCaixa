import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso, Cartao, Pagina, botao, botaoPrimario, campo } from '../components/ui'
import { fecharComanda, lerComanda, type Leitura } from '../lib/api'
import { formatarReais, normalizarNumero } from '../lib/comanda'
import { prepararFoto } from '../lib/foto'
import { salvarUltimo } from '../lib/ultimo'

export default function MesaPage() {
  const { mesa } = useParams()
  const navigate = useNavigate()
  const [previa, setPrevia] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [numeroDigitado, setNumeroDigitado] = useState('')
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const numero = normalizarNumero(numeroDigitado)

  async function aoFotografar(arquivo: File) {
    setErro(null)
    setLeitura(null)
    setLendo(true)
    try {
      const foto = await prepararFoto(arquivo)
      setPrevia(foto.previa)
      const l = await lerComanda(foto.base64, mesa)
      setLeitura(l)
      setNumeroDigitado(l.numero_lido ?? '')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLendo(false)
    }
  }

  async function pagar() {
    if (!leitura || !numero) return
    setEnviando(true)
    setErro(null)
    try {
      const { id } = await fecharComanda({ leitura_id: leitura.leitura_id, numero, metodo })
      salvarUltimo(id)
      navigate(`/c/${id}`)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const botaoFoto = (rotulo: string, primario: boolean) => (
    <label className={`${primario ? botaoPrimario : botao} cursor-pointer`}>
      {rotulo}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={lendo}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void aoFotografar(f)
        }}
      />
    </label>
  )

  return (
    <Pagina>
      {mesa && <p className="text-sm text-apagado">Mesa {mesa}</p>}

      <Cartao titulo="Sua comanda">
        <p className="text-sm text-apagado">
          Coloque a comanda sobre a mesa, bem iluminada, e fotografe ela inteira, do número no topo até o fim das bebidas. O app soma as etiquetas da
          balança e as bebidas marcadas pelo garçom.
        </p>
        {previa && <img src={previa} alt="Foto da comanda" className="max-h-72 rounded-xl object-contain" />}
        {lendo ? <Aviso tom="aviso">Lendo a comanda… isso leva alguns segundos.</Aviso> : botaoFoto(previa ? 'Fotografar de novo' : 'Fotografar comanda', !leitura)}
      </Cartao>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {leitura && (
        <>
          <Cartao titulo="Número da comanda">
            <p className="text-sm text-apagado">Confira com o número impresso no topo. Corrija se estiver diferente.</p>
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
            {numero ? <Aviso tom="ok">Comanda {numero}</Aviso> : <Aviso tom="aviso">Não consegui ler o número. Digite os números do topo da comanda.</Aviso>}
          </Cartao>

          <Cartao titulo="O que encontrei">
            {leitura.itens.length === 0 ? (
              <p className="text-sm text-apagado">Não encontrei etiquetas nem bebidas marcadas. Fotografe de novo.</p>
            ) : (
              <div className="flex flex-col gap-1 font-mono text-sm">
                {leitura.itens.map((it, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">{it.descricao}</span>
                    <span className="tabular-nums">{formatarReais(it.centavos)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-dashed border-linha pt-2 text-lg font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatarReais(leitura.total_centavos)}</span>
                </div>
              </div>
            )}
            {leitura.avisos.map((a, i) => (
              <Aviso key={i} tom="aviso">
                {a}
              </Aviso>
            ))}
            <p className="text-sm text-apagado">Se algo estiver errado, fotografe de novo. A portaria confere com a comanda de papel na saída.</p>
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

          <div className="fixed inset-x-0 bottom-0 border-t border-linha bg-papel px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3">
              <div>
                <div className="text-xs tracking-widest text-apagado uppercase">Total</div>
                <div className="font-mono text-2xl font-semibold tabular-nums">{formatarReais(leitura.total_centavos)}</div>
              </div>
              <button type="button" className={botaoPrimario} disabled={!numero || leitura.total_centavos <= 0 || enviando} onClick={pagar}>
                {enviando ? 'Enviando…' : 'Pagar'}
              </button>
            </div>
          </div>
        </>
      )}
    </Pagina>
  )
}

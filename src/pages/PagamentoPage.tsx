import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Qr } from '../components/Qr'
import { Aviso, Cartao, Pagina, botao, botaoPrimario } from '../components/ui'
import { confirmarSimulado, statusFechamento, type Fechamento } from '../lib/api'
import { formatarReais, textoQrValidacao } from '../lib/comanda'
import { lerFoto } from '../lib/ultimo'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function PagamentoPage() {
  const { id = '' } = useParams()
  const [f, setF] = useState<Fechamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [foto] = useState(() => lerFoto(id))

  const carregar = useCallback(async () => {
    try {
      setF(await statusFechamento(id))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    statusFechamento(id).then(
      (dados) => setF(dados),
      (e: Error) => setErro(e.message),
    )
  }, [id])

  // Com um provedor real, a confirmação chega pelo webhook: o celular consulta a cada 3 s.
  useEffect(() => {
    if (!f || f.status !== 'pendente' || f.provedor === 'simulado') return
    const t = setInterval(() => void carregar(), 3000)
    return () => clearInterval(t)
  }, [f, carregar])

  async function simularAprovado() {
    setConfirmando(true)
    try {
      await confirmarSimulado(id)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setConfirmando(false)
    }
  }

  if (!f) {
    return (
      <Pagina>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : <p className="text-apagado">Carregando…</p>}
        <Link to="/" className={botao}>
          Voltar ao início
        </Link>
      </Pagina>
    )
  }

  if (f.status === 'pago' && f.codigo) {
    return (
      <Pagina>
        <Telas
          telas={[
            <Cartao key="qr" titulo="Pagamento confirmado">
              {f.usado_em ? (
                <Aviso tom="aviso">A saída desta comanda já foi registrada às {hora(f.usado_em)}.</Aviso>
              ) : (
                <p className="text-center">Mostre este código na portaria.</p>
              )}
              <Qr texto={textoQrValidacao(f.numero, f.codigo)} rotulo="QR Code de validação" />
              <div className="text-center text-sm text-apagado">Comanda</div>
              <div className="text-center font-mono text-3xl font-semibold tracking-[0.18em]">{f.numero}</div>
              <div className="text-center text-sm text-apagado">Código de validação</div>
              <div className="text-center font-mono text-3xl font-semibold tracking-[0.18em]">{f.codigo}</div>
              <div className="text-center font-mono">
                Pago {formatarReais(f.total_centavos)} via {f.metodo === 'pix' ? 'Pix' : 'cartão'}
              </div>
              <p className="text-center text-sm text-apagado">Vale uma única saída. Deixe a comanda de papel na portaria.</p>
            </Cartao>,
            ...(foto
              ? [
                  <Cartao key="foto" titulo={`Comanda ${f.numero}`}>
                    <img src={foto} alt="Foto da comanda" className="w-full rounded-xl object-contain" />
                    <p className="text-center text-sm text-apagado">Foto que você enviou para a leitura.</p>
                  </Cartao>,
                ]
              : []),
          ]}
        />
        <Link to="/comanda" className={botao}>
          Pagar outra comanda
        </Link>
      </Pagina>
    )
  }

  return (
    <Pagina>
      <Cartao titulo={`Comanda ${f.numero}`}>
        <div className="flex flex-col gap-1 font-mono text-sm">
          {(f.itens ?? []).map((it, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span>{it.descricao}</span>
              <span className="tabular-nums">{formatarReais(it.centavos)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-dashed border-linha pt-2 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatarReais(f.total_centavos)}</span>
          </div>
        </div>
      </Cartao>

      {f.status === 'cancelado' ? (
        <Aviso tom="erro">Esta cobrança foi cancelada. Volte e feche a comanda de novo.</Aviso>
      ) : (
        <Cartao titulo={f.metodo === 'pix' ? 'Pagar com Pix' : 'Pagar com cartão'}>
          {f.cobranca?.pixQrImagem && <img src={f.cobranca.pixQrImagem} alt="QR Code Pix" className="mx-auto w-64 rounded-xl bg-white p-2" />}
          {f.cobranca?.pixCopiaECola && (
            <button type="button" className={botao} onClick={() => void navigator.clipboard?.writeText(f.cobranca!.pixCopiaECola!)}>
              Copiar código Pix
            </button>
          )}
          {f.cobranca?.urlPagamento && (
            <a href={f.cobranca.urlPagamento} className={botaoPrimario}>
              Ir para o pagamento com cartão
            </a>
          )}
          {f.provedor === 'simulado' ? (
            <>
              <Aviso tom="aviso">Pagamento simulado: nenhum valor é cobrado. O Asaas entra numa próxima fase.</Aviso>
              <button type="button" className={`${botao} border-emerald-700 bg-emerald-700 text-white`} disabled={confirmando} onClick={simularAprovado}>
                {confirmando ? 'Confirmando…' : 'Simular pagamento aprovado'}
              </button>
            </>
          ) : (
            <p className="text-sm text-apagado">Aguardando a confirmação do pagamento…</p>
          )}
        </Cartao>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Link to="/comanda" className={botao}>
        Fotografar a comanda de novo
      </Link>
    </Pagina>
  )
}

/** Telas lado a lado: o cliente arrasta para o lado para ver a próxima. */
function Telas({ telas }: { telas: ReactNode[] }) {
  const [atual, setAtual] = useState(0)
  if (telas.length === 1) return <>{telas[0]}</>
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none]"
        onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth + 16)))}
      >
        {telas.map((t, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {t}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-apagado">
        {telas.map((_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i === atual ? 'bg-vinho-600' : 'bg-linha'}`} />
        ))}
        <span className="ml-1">{atual === 0 ? 'Arraste para ver a foto da comanda' : 'Arraste para voltar ao QR'}</span>
      </div>
    </div>
  )
}

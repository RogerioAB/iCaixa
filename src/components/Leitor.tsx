import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useEffect, useRef, useState } from 'react'
import { botao, botaoPrimario } from './ui'

type Props = {
  tipo: 'etiqueta' | 'qr'
  rotulo: string
  onLido: (texto: string) => void
}

function criarLeitor(tipo: Props['tipo']) {
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, tipo === 'qr' ? [BarcodeFormat.QR_CODE] : [BarcodeFormat.EAN_13])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints)
}

/**
 * Lê código de barras ou QR pela câmera ao vivo (precisa de HTTPS).
 * Se a câmera não abrir, o cliente ainda pode mandar uma foto.
 */
export function Leitor({ tipo, rotulo, onLido }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const controles = useRef<IScannerControls | null>(null)
  const ultimo = useRef<{ texto: string; quando: number } | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const onLidoRef = useRef(onLido)
  useEffect(() => {
    onLidoRef.current = onLido
  }, [onLido])

  useEffect(() => {
    if (!aberto || !video.current) return
    let cancelado = false
    criarLeitor(tipo)
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (res) => {
        if (!res) return
        const texto = res.getText()
        // A câmera lê o mesmo código várias vezes por segundo: ignora repetições próximas.
        const agora = Date.now()
        if (ultimo.current && ultimo.current.texto === texto && agora - ultimo.current.quando < 2500) return
        ultimo.current = { texto, quando: agora }
        navigator.vibrate?.(60)
        onLidoRef.current(texto)
        if (tipo === 'qr') setAberto(false)
      })
      .then((c) => {
        if (cancelado) c.stop()
        else controles.current = c
      })
      .catch(() => {
        setErro('Não foi possível abrir a câmera. Permita o acesso ou envie uma foto.')
        setAberto(false)
      })
    return () => {
      cancelado = true
      controles.current?.stop()
      controles.current = null
    }
  }, [aberto, tipo])

  async function lerFoto(arquivo: File) {
    setErro(null)
    const url = URL.createObjectURL(arquivo)
    try {
      const res = await criarLeitor(tipo).decodeFromImageUrl(url)
      onLidoRef.current(res.getText())
    } catch {
      setErro('Não encontrei o código na foto. Chegue mais perto, com boa luz.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {aberto ? (
        <>
          <video ref={video} className="aspect-[4/3] w-full rounded-xl bg-black object-cover" muted playsInline />
          <button type="button" className={botao} onClick={() => setAberto(false)}>
            Fechar câmera
          </button>
        </>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="button" className={botaoPrimario} onClick={() => (setErro(null), setAberto(true))}>
            {rotulo}
          </button>
          <label className={`${botao} cursor-pointer`}>
            Foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void lerFoto(f)
              }}
            />
          </label>
        </div>
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </div>
  )
}

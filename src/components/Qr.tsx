import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function Qr({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(texto, { margin: 2, width: 520, errorCorrectionLevel: 'M' }).then((url) => vivo && setSrc(url))
    return () => {
      vivo = false
    }
  }, [texto])
  return (
    <div className="mx-auto w-full max-w-64 rounded-xl bg-white p-2">
      {src ? <img src={src} alt={rotulo} className="block w-full" /> : <div className="aspect-square" />}
    </div>
  )
}

import { useEffect, useState } from 'react'

const ETAPAS = ['Procurando o número da comanda', 'Lendo as etiquetas da balança', 'Contando as bebidas marcadas', 'Somando o total']

function Ampulheta() {
  return (
    <svg viewBox="0 0 64 80" className="ampulheta h-20 w-16" aria-hidden>
      <rect x="8" y="2" width="48" height="6" rx="3" className="fill-vinho-600" />
      <rect x="8" y="72" width="48" height="6" rx="3" className="fill-vinho-600" />
      <path d="M14 8 h36 v6 c0 10 -12 18 -16 26 c4 8 16 16 16 26 v6 h-36 v-6 c0 -10 12 -18 16 -26 c-4 -8 -16 -16 -16 -26 z" className="fill-white stroke-vinho-600" strokeWidth="2.5" />
      <path d="M19 15 h26 c-2 8 -9 13 -13 20 c-4 -7 -11 -12 -13 -20 z" className="areia-cima fill-amber-400" />
      <path d="M32 50 c5 5 12 9 13 16 h-26 c1 -7 8 -11 13 -16 z" className="areia-baixo fill-amber-400" />
      <rect x="31" y="38" width="2" height="26" className="fill-amber-400" opacity="0.7" />
    </svg>
  )
}

/** Tela mostrada enquanto a IA lê a foto: ampulheta, a foto com uma faixa varrendo e as etapas. */
export function LendoComanda({ previa }: { previa: string | null }) {
  const [etapa, setEtapa] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1)), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-fundo/95 px-6 backdrop-blur-sm">
      {previa && (
        <div className="relative w-40 overflow-hidden rounded-xl border border-linha shadow-lg">
          <img src={previa} alt="" className="block w-full opacity-80" />
          <div className="varredura absolute inset-x-0 h-[3px] bg-vinho-600 shadow-[0_0_14px_4px_rgba(155,27,74,0.55)]" />
        </div>
      )}
      <Ampulheta />
      <div className="text-center">
        <div className="text-xl font-bold">Lendo sua comanda</div>
        <div key={etapa} className="surgir mt-1 text-apagado">
          {ETAPAS[etapa]}…
        </div>
      </div>
      <ol className="flex gap-1.5" aria-hidden>
        {ETAPAS.map((_, i) => (
          <li key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i <= etapa ? 'bg-vinho-600' : 'bg-linha'}`} />
        ))}
      </ol>
      <p className="max-w-xs text-center text-sm text-apagado">Isso leva alguns segundos. Não feche esta tela.</p>
    </div>
  )
}

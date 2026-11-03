import { restaurante } from '../restaurante'

export function CabecalhoRestaurante({ mesa }: { mesa?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-linha bg-papel p-4">
      {restaurante.logo ? (
        <img src={restaurante.logo} alt={restaurante.nome} className="h-14 w-14 shrink-0 rounded-xl object-contain" />
      ) : (
        <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-vinho-600 text-2xl font-bold text-white">
          {restaurante.nome[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-bold tracking-tight">{restaurante.nome}</div>
        <div className="text-sm text-apagado">{restaurante.local}</div>
      </div>
      {mesa && (
        <div className="shrink-0 rounded-xl bg-vinho-50 px-3 py-1.5 text-center">
          <div className="text-[10px] font-bold tracking-widest text-vinho-600 uppercase">Mesa</div>
          <div className="font-mono text-lg font-semibold leading-tight">{mesa}</div>
        </div>
      )}
    </div>
  )
}

import type { Restaurante } from '../lib/restaurantes'

export function LogoRestaurante({ r, tamanho = 'h-14 w-14' }: { r: Pick<Restaurante, 'nome' | 'logo_url'>; tamanho?: string }) {
  return r.logo_url ? (
    <img src={r.logo_url} alt={r.nome} className={`${tamanho} shrink-0 rounded-xl bg-white object-contain p-1`} />
  ) : (
    <div aria-hidden className={`${tamanho} flex shrink-0 items-center justify-center rounded-xl bg-vinho-600 text-2xl font-bold text-white`}>
      {r.nome.trim()[0]?.toUpperCase()}
    </div>
  )
}

export function CabecalhoRestaurante({ r, mesa }: { r: Restaurante; mesa?: string }) {
  const site = r.site?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-linha bg-papel p-4">
      <LogoRestaurante r={r} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-bold tracking-tight">{r.nome}</div>
        {r.local && <div className="truncate text-sm text-apagado">{r.local}</div>}
        {site && (
          <a href={r.site!} target="_blank" rel="noreferrer" className="block truncate text-sm text-vinho-600 underline">
            {site}
          </a>
        )}
      </div>
      {mesa && (
        <div className="shrink-0 rounded-xl bg-vinho-50 px-3 py-1.5 text-center">
          <div className="text-[10px] font-bold tracking-widest text-vinho-600 uppercase">Mesa</div>
          <div className="font-mono text-lg leading-tight font-semibold">{mesa}</div>
        </div>
      )}
    </div>
  )
}

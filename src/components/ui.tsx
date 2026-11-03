import type { ReactNode } from 'react'

export function Pagina({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32">
      <header className="flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tight">
          i<span className="text-vinho-600">Caixa</span>
        </div>
      </header>
      {children}
    </div>
  )
}

export function Cartao({ titulo, children }: { titulo?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linha bg-papel p-4">
      {titulo && <h2 className="text-xs font-bold tracking-widest text-vinho-600 uppercase">{titulo}</h2>}
      {children}
    </section>
  )
}

type Tom = 'ok' | 'erro' | 'aviso'
const TONS: Record<Tom, string> = {
  ok: 'bg-emerald-50 text-emerald-800',
  erro: 'bg-red-50 text-red-800',
  aviso: 'bg-amber-50 text-amber-800',
}

export function Aviso({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <div className={`rounded-xl px-3 py-2 text-sm ${TONS[tom]}`}>{children}</div>
}

export const botao =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-linha bg-papel px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-vinho-600'
export const botaoPrimario = `${botao} border-vinho-600 bg-vinho-600 text-white`
export const campo =
  'w-full min-w-0 rounded-xl border border-linha bg-fundo px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-vinho-600'

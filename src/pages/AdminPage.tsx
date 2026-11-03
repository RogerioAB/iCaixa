import type { Session } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent } from 'react'
import { Login } from '../components/Login'
import { LogoRestaurante } from '../components/Restaurante'
import { Aviso, Cartao, Pagina, botao, botaoPrimario, campo } from '../components/ui'
import { formatarReais } from '../lib/comanda'
import {
  enderecoPublico,
  enviarLogo,
  excluirProduto,
  gerarSlug,
  listarProdutos,
  listarRestaurantes,
  salvarProduto,
  salvarRestaurante,
  type Produto,
  type Restaurante,
} from '../lib/restaurantes'
import { supabase } from '../lib/supabase'

const rotulo = 'text-xs font-semibold text-apagado'

export default function AdminPage() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) return
    supabase.rpc('eh_admin').then(({ data }) => setAdmin(data === true))
  }, [sessao])

  if (sessao === undefined) return <Pagina>{null}</Pagina>
  if (!sessao)
    return (
      <Pagina>
        <Login titulo="Administração" />
      </Pagina>
    )

  return (
    <Pagina>
      <div className="flex items-center justify-between text-sm text-apagado">
        <span className="truncate">{sessao.user.email}</span>
        <button type="button" className="underline" onClick={() => void supabase.auth.signOut()}>
          Sair
        </button>
      </div>
      {admin === null ? (
        <p className="text-apagado">Carregando…</p>
      ) : admin ? (
        <Restaurantes />
      ) : (
        <Aviso tom="erro">Seu usuário não é administrador do iCaixa.</Aviso>
      )}
    </Pagina>
  )
}

function Restaurantes() {
  const [lista, setLista] = useState<Restaurante[] | null>(null)
  const [editando, setEditando] = useState<Restaurante | 'novo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = () => listarRestaurantes().then(setLista, (e: Error) => setErro(e.message))
  useEffect(() => {
    listarRestaurantes().then(setLista, (e: Error) => setErro(e.message))
  }, [])

  if (editando)
    return (
      <EditorRestaurante
        inicial={editando === 'novo' ? null : editando}
        onVoltar={() => {
          setEditando(null)
          void carregar()
        }}
      />
    )

  return (
    <Cartao titulo="Restaurantes">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {lista?.length === 0 && <p className="text-sm text-apagado">Nenhum restaurante cadastrado.</p>}
      {lista?.map((r) => (
        <button key={r.id} type="button" onClick={() => setEditando(r)} className="flex items-center gap-3 rounded-xl border border-linha p-3 text-left">
          <LogoRestaurante r={r} tamanho="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.nome}</div>
            <div className="truncate font-mono text-xs text-apagado">/{r.slug}</div>
          </div>
          {!r.ativo && <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Inativo</span>}
        </button>
      ))}
      <button type="button" className={botaoPrimario} onClick={() => setEditando('novo')}>
        Novo restaurante
      </button>
    </Cartao>
  )
}

function EditorRestaurante({ inicial, onVoltar }: { inicial: Restaurante | null; onVoltar: () => void }) {
  const [r, setR] = useState<Restaurante | null>(inicial)
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [slug, setSlug] = useState(inicial?.slug ?? '')
  const [slugManual, setSlugManual] = useState(Boolean(inicial))
  const [local, setLocal] = useState(inicial?.local ?? '')
  const [site, setSite] = useState(inicial?.site ?? '')
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true)
  const [logo, setLogo] = useState<File | null>(null)
  const [previaLogo, setPreviaLogo] = useState<string | null>(inicial?.logo_url ?? null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    setOk(false)
    try {
      const siteNormal = site.trim() ? (/^https?:\/\//.test(site.trim()) ? site.trim() : `https://${site.trim()}`) : null
      const logo_url = logo ? await enviarLogo(slug, logo) : (r?.logo_url ?? null)
      const salvo = await salvarRestaurante({ id: r?.id, nome: nome.trim(), slug, local: local.trim() || null, site: siteNormal, logo_url, ativo })
      setR(salvo)
      setSite(salvo.site ?? '')
      setLogo(null)
      setOk(true)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <button type="button" className="self-start text-sm text-apagado underline" onClick={onVoltar}>
        ← Restaurantes
      </button>
      <Cartao titulo={r ? r.nome : 'Novo restaurante'}>
        <form className="flex flex-col gap-3" onSubmit={salvar}>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Nome</span>
            <input
              className={campo}
              required
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (!slugManual) setSlug(gerarSlug(e.target.value))
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Endereço no iCaixa</span>
            <div className="flex items-center rounded-xl border border-linha bg-fundo pl-3 font-mono text-sm">
              <span className="text-apagado">{window.location.host}/</span>
              <input
                className="w-full min-w-0 bg-transparent py-2.5 pr-3 outline-none"
                required
                pattern="[a-z0-9]([a-z0-9\-]{0,38}[a-z0-9])?"
                value={slug}
                onChange={(e) => {
                  setSlugManual(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
              />
            </div>
            {r && slug !== r.slug && <span className="text-xs text-amber-800">Mudar o endereço invalida os QR Codes já impressos.</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Bairro ou cidade (opcional)</span>
            <input className={campo} value={local} onChange={(e) => setLocal(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotulo}>Site (opcional)</span>
            <input className={campo} inputMode="url" placeholder="www.restaurante.com.br" value={site} onChange={(e) => setSite(e.target.value)} />
          </label>
          <div className="flex items-center gap-3">
            {previaLogo ? (
              <img src={previaLogo} alt="Logo" className="h-16 w-16 rounded-xl border border-linha bg-white object-contain p-1" />
            ) : (
              <LogoRestaurante r={{ nome: nome || '?', logo_url: null }} tamanho="h-16 w-16" />
            )}
            <label className={`${botao} cursor-pointer`}>
              {previaLogo ? 'Trocar logo' : 'Enviar logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 2 * 1024 * 1024) return setErro('O logo deve ter no máximo 2 MB.')
                  setLogo(f)
                  setPreviaLogo(URL.createObjectURL(f))
                }}
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>Ativo (clientes conseguem pagar)</span>
          </label>
          <button className={botaoPrimario} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {ok && <Aviso tom="ok">Salvo.</Aviso>}
          {erro && <Aviso tom="erro">{erro}</Aviso>}
        </form>
      </Cartao>

      {r && <QrMesas slug={r.slug} nome={r.nome} />}
      {r && <Produtos restauranteId={r.id} />}
    </>
  )
}

function QrMesas({ slug, nome }: { slug: string; nome: string }) {
  const url = enderecoPublico(slug)
  const [png, setPng] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 2, width: 1024, errorCorrectionLevel: 'M' }).then(setPng)
  }, [url])
  return (
    <Cartao titulo="QR Code das mesas">
      <p className="text-sm text-apagado">
        Imprima este QR Code e coloque nas mesas. Ele abre{' '}
        <a href={url} target="_blank" rel="noreferrer" className="font-mono text-vinho-600 underline">
          {url.replace(/^https?:\/\//, '')}
        </a>
        .
      </p>
      {png && <img src={png} alt={`QR Code de ${nome}`} className="mx-auto w-48 rounded-xl bg-white p-2" />}
      {png && (
        <a href={png} download={`icaixa-${slug}-qrcode.png`} className={botao}>
          Baixar QR Code
        </a>
      )}
    </Cartao>
  )
}

type Linha = Produto & { novo?: boolean; precoTexto: string; sujo?: boolean }

const paraLinha = (p: Produto): Linha => ({ ...p, precoTexto: (p.preco_centavos / 100).toFixed(2).replace('.', ',') })
const lerPreco = (t: string) => Math.round(Number(t.replace(/\./g, '').replace(',', '.')) * 100)

function Produtos({ restauranteId }: { restauranteId: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarProdutos(restauranteId).then((ps) => setLinhas(ps.map(paraLinha)), (e: Error) => setErro(e.message))
  }, [restauranteId])

  const mudar = (i: number, campos: Partial<Linha>) => setLinhas((ls) => ls!.map((l, j) => (j === i ? { ...l, ...campos, sujo: true } : l)))

  async function salvar(i: number) {
    const l = linhas![i]
    const preco = lerPreco(l.precoTexto)
    if (!l.nome.trim() || !(preco > 0)) return setErro('Preencha o nome e um preço maior que zero.')
    let id = l.id
    if (l.novo) {
      const base = gerarSlug(l.nome) || 'produto'
      id = base
      for (let n = 2; linhas!.some((o, j) => j !== i && o.id === id); n++) id = `${base}-${n}`
    }
    const p: Produto = {
      restaurante_id: restauranteId,
      id,
      nome: l.nome.trim(),
      linha_comanda: l.linha_comanda?.trim() || null,
      preco_centavos: preco,
      ordem: l.ordem,
      ativo: l.ativo,
    }
    try {
      setErro(null)
      await salvarProduto(p)
      setLinhas((ls) => ls!.map((o, j) => (j === i ? paraLinha(p) : o)))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function excluir(i: number) {
    const l = linhas![i]
    if (!l.novo) {
      if (!window.confirm(`Excluir ${l.nome}?`)) return
      try {
        await excluirProduto(l)
      } catch (e) {
        return setErro((e as Error).message)
      }
    }
    setLinhas((ls) => ls!.filter((_, j) => j !== i))
  }

  function adicionar() {
    const ordem = Math.max(0, ...(linhas ?? []).map((l) => l.ordem)) + 10
    setLinhas((ls) => [
      ...(ls ?? []),
      { restaurante_id: restauranteId, id: '', nome: '', linha_comanda: '', preco_centavos: 0, precoTexto: '', ordem, ativo: true, novo: true, sujo: true },
    ])
  }

  return (
    <Cartao titulo="Bebidas e preços">
      <p className="text-sm text-apagado">
        "Linha na comanda" é o texto impresso na grade de bebidas da comanda de papel. A IA usa esse texto para achar as marcas do garçom. Comida e sobremesa
        vêm pela etiqueta da balança e não entram aqui.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {linhas?.map((l, i) => (
        <div key={l.novo ? `novo-${i}` : l.id} className="flex flex-col gap-2 rounded-xl border border-linha p-3">
          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <input className={campo} placeholder="Nome" value={l.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
            <div className="flex items-center rounded-xl border border-linha bg-fundo pl-3 font-mono">
              <span className="text-sm text-apagado">R$</span>
              <input
                className="w-full min-w-0 bg-transparent px-2 py-2.5 text-right outline-none"
                inputMode="decimal"
                placeholder="0,00"
                value={l.precoTexto}
                onChange={(e) => mudar(i, { precoTexto: e.target.value.replace(/[^0-9,]/g, '') })}
              />
            </div>
          </div>
          <input className={campo} placeholder="Linha na comanda (ex.: Água)" value={l.linha_comanda ?? ''} onChange={(e) => mudar(i, { linha_comanda: e.target.value })} />
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input type="checkbox" checked={l.ativo} onChange={(e) => mudar(i, { ativo: e.target.checked })} />
              Ativo
            </label>
            <button type="button" className="text-sm text-red-700 underline" onClick={() => void excluir(i)}>
              Excluir
            </button>
            <button type="button" className={`${botao} py-1.5`} disabled={!l.sujo} onClick={() => void salvar(i)}>
              {l.sujo ? 'Salvar' : formatarReais(l.preco_centavos)}
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={botao} onClick={adicionar}>
        Adicionar bebida
      </button>
    </Cartao>
  )
}

// Interface do provedor de pagamento.
// Hoje só existe o provedor "simulado". Na fase do Asaas, crie um AsaasProvedor que
// implemente esta mesma interface e uma Edge Function `asaas-webhook` que chame
// `confirmarPagamento` (em _shared/fechamento.ts) quando o Asaas avisar que o pagamento caiu.

export type MetodoPagamento = 'pix' | 'cartao'

export type NovaCobranca = {
  fechamentoId: string
  numero: string
  totalCentavos: number
  metodo: MetodoPagamento
}

export type Cobranca = {
  /** Id da cobrança no provedor (no Asaas, o id do payment). */
  referencia: string
  /** Pix: texto "copia e cola" e imagem do QR (data URL), quando o provedor fornece. */
  pixCopiaECola?: string
  pixQrImagem?: string
  /** Cartão: página segura do provedor onde o cliente digita o cartão. */
  urlPagamento?: string
}

export interface ProvedorPagamento {
  readonly nome: string
  criarCobranca(dados: NovaCobranca): Promise<Cobranca>
}

/** Não cobra nada. O cliente confirma pelo botão "Simular pagamento aprovado". */
export class ProvedorSimulado implements ProvedorPagamento {
  readonly nome = 'simulado'
  criarCobranca(dados: NovaCobranca): Promise<Cobranca> {
    return Promise.resolve({
      referencia: `sim_${dados.fechamentoId}`,
      pixCopiaECola: dados.metodo === 'pix' ? `PIX SIMULADO - comanda ${dados.numero}` : undefined,
    })
  }
}

export function escolherProvedor(nome: string | undefined): ProvedorPagamento {
  switch (nome ?? 'simulado') {
    case 'simulado':
      return new ProvedorSimulado()
    // case 'asaas': return new AsaasProvedor(Deno.env.get('ASAAS_API_KEY')!)
    default:
      throw new Error(`Provedor de pagamento desconhecido: ${nome}`)
  }
}

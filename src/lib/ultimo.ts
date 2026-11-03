// Guarda o último fechamento deste celular, para o cliente reabrir o QR se fechar a aba.
const CHAVE = 'icaixa:ultimo-fechamento'

export function salvarUltimo(id: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ id, em: Date.now() }))
  } catch {
    /* navegação privada: segue sem guardar */
  }
}

export function lerUltimo(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as { id: string; em: number } | null
    // Depois de 12 horas não faz mais sentido mostrar.
    return v && Date.now() - v.em < 12 * 3600 * 1000 ? v.id : null
  } catch {
    return null
  }
}

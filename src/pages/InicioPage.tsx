import { Link } from 'react-router-dom'
import { Cartao, Pagina, botao } from '../components/ui'
import { lerUltimo } from '../lib/ultimo'

export default function InicioPage() {
  const ultimo = lerUltimo()
  return (
    <Pagina>
      <Cartao titulo="Pague sua comanda na mesa">
        <p>Leia o QR Code que está na mesa do restaurante. Você fotografa a comanda, paga com Pix ou cartão e sai sem fila. Sem baixar aplicativo e sem cadastro.</p>
        {ultimo && (
          <Link to={`/c/${ultimo}`} className={botao}>
            Ver meu último pagamento
          </Link>
        )}
      </Cartao>
      <div className="flex justify-center gap-4 text-sm text-apagado">
        <Link to="/portaria" className="underline">
          Portaria
        </Link>
        <Link to="/admin" className="underline">
          Administração
        </Link>
      </div>
    </Pagina>
  )
}

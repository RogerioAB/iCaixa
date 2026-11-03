import { Link } from 'react-router-dom'
import { Cartao, Pagina, botao, botaoPrimario } from '../components/ui'
import { lerUltimo } from '../lib/ultimo'

export default function InicioPage() {
  const ultimo = lerUltimo()
  return (
    <Pagina>
      <Cartao titulo="Pague sua comanda na mesa">
        <p>Leia o QR Code que está na sua mesa, ou comece por aqui. Sem baixar aplicativo e sem cadastro.</p>
        <Link to="/comanda" className={botaoPrimario}>
          Pagar minha comanda
        </Link>
        {ultimo && (
          <Link to={`/c/${ultimo}`} className={botao}>
            Ver meu último pagamento
          </Link>
        )}
      </Cartao>
      <Link to="/portaria" className="text-center text-sm text-apagado underline">
        Acesso da portaria
      </Link>
    </Pagina>
  )
}

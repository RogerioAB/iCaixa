import { Route, Routes } from 'react-router-dom'
import InicioPage from './pages/InicioPage'
import MesaPage from './pages/MesaPage'
import PagamentoPage from './pages/PagamentoPage'
import PortariaPage from './pages/PortariaPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<InicioPage />} />
      {/* O QR Code de cada mesa aponta para /m/<número da mesa> */}
      <Route path="/m/:mesa" element={<MesaPage />} />
      <Route path="/comanda" element={<MesaPage />} />
      <Route path="/c/:id" element={<PagamentoPage />} />
      <Route path="/portaria" element={<PortariaPage />} />
      <Route path="*" element={<InicioPage />} />
    </Routes>
  )
}

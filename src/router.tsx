import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import InicioPage from './pages/InicioPage'
import MesaPage from './pages/MesaPage'
import PagamentoPage from './pages/PagamentoPage'
import PortariaPage from './pages/PortariaPage'

// Endereços antigos (/m/<mesa>) eram todos do Temperarte.
function MesaAntiga() {
  const { mesa } = useParams()
  return <Navigate to={`/temperarte/${mesa ?? ''}`} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<InicioPage />} />
      <Route path="/c/:id" element={<PagamentoPage />} />
      <Route path="/portaria" element={<PortariaPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/m/:mesa" element={<MesaAntiga />} />
      {/* O QR Code das mesas aponta para /<restaurante> ou /<restaurante>/<mesa> */}
      <Route path="/:slug" element={<MesaPage />} />
      <Route path="/:slug/:mesa" element={<MesaPage />} />
      <Route path="*" element={<InicioPage />} />
    </Routes>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRouter } from './router'
import { erroConfig } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {erroConfig ? (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>iCaixa não configurado</h1>
        <p>{erroConfig}</p>
      </main>
    ) : (
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    )}
  </StrictMode>,
)

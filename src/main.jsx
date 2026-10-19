import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Tipografía self-hosted (oct 2026, Bloque 2): Manrope para display/H1/H2/
// métricas grandes, Inter para texto — reemplaza la carga vía Google Fonts
// CDN de index.html (Montserrat/Space Grotesk/Inter), nunca se vuelve a
// cargar nada de fonts.googleapis.com.
import '@fontsource-variable/manrope'
import '@fontsource-variable/inter'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

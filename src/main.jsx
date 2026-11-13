import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Tipografía self-hosted: nunca se carga nada de fonts.googleapis.com.
import '@fontsource-variable/manrope'
import './index.css'
import { registrarServiceWorker } from './lib/registrarSW'

// PWA: la app no espera por el service worker, se registra y sigue.
registrarServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

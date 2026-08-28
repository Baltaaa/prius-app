import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import PrivateRoute from './components/PrivateRoute'
import GlobalLoader from './components/ui/GlobalLoader'

// El login es la primera pantalla: solo él se carga en el bundle inicial.
// Todo el CRM va lazy -> se descarga recién al autenticarse, en chunks por página.
const AppLayout = lazy(() => import('./layouts/AppLayout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Home = lazy(() => import('./pages/crm/Home'))
const Reservas = lazy(() => import('./pages/crm/Reservas'))
const Clientes = lazy(() => import('./pages/crm/Clientes'))
const Caja = lazy(() => import('./pages/crm/Caja'))
const Reportes = lazy(() => import('./pages/crm/Reportes'))
const Calendario = lazy(() => import('./pages/crm/Calendario'))
const Notificaciones = lazy(() => import('./pages/crm/Notificaciones'))
const Comprobantes = lazy(() => import('./pages/crm/Comprobantes'))
const Perfil = lazy(() => import('./pages/crm/Perfil'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<GlobalLoader message="Cargando módulo" />}>
        <Routes>
          {/* Public Login Route */}
          <Route path="/" element={<Login />} />

          {/* SPA PriusAdmin Section */}
          <Route
            path="/app"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/app/home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="plano" element={<Dashboard />} />
            <Route path="reservas" element={<Reservas />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="caja" element={<Caja />} />
            <Route path="reportes" element={<Reportes />} />

            {/* Módulos Nuevos */}
            <Route path="calendario" element={<Calendario />} />
            <Route path="notificaciones" element={<Notificaciones />} />
            <Route path="comprobantes" element={<Comprobantes />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/app/home" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

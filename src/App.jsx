import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CambiarContrasena from './pages/CambiarContrasena'
import PrivateRoute from './components/PrivateRoute'
import GlobalLoader from './components/ui/GlobalLoader'
import { AuthProvider } from './context/AuthProvider'

// El login es la primera pantalla: solo él se carga en el bundle inicial.
// Todo el CRM va lazy -> se descarga recién al autenticarse, en chunks por página.
const AppLayout = lazy(() => import('./layouts/AppLayout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CabinasLockers = lazy(() => import('./pages/crm/CabinasLockers'))
const Home = lazy(() => import('./pages/crm/Home'))
const Reservas = lazy(() => import('./pages/crm/Reservas'))
const Clientes = lazy(() => import('./pages/crm/Clientes'))
const Caja = lazy(() => import('./pages/crm/Caja'))
const Reportes = lazy(() => import('./pages/crm/Reportes'))
const Actividad = lazy(() => import('./pages/crm/Actividad'))
const Ocupacion = lazy(() => import('./pages/crm/Ocupacion'))
const Leads = lazy(() => import('./pages/crm/Leads'))
const Notificaciones = lazy(() => import('./pages/crm/Notificaciones'))
const Comprobantes = lazy(() => import('./pages/crm/Comprobantes'))
const Perfil = lazy(() => import('./pages/crm/Perfil'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<GlobalLoader message="Cargando módulo" />}>
          <Routes>
            {/* Login: "/" se mantiene por compatibilidad, "/login" es la ruta canónica. */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar" element={<Login modo="recover" />} />
            <Route path="/restablecer-contrasena" element={<CambiarContrasena modoRecuperacion />} />
            <Route
              path="/cambiar-contrasena"
              element={
                <PrivateRoute>
                  <CambiarContrasena />
                </PrivateRoute>
              }
            />

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
              <Route path="cabinas-lockers" element={<CabinasLockers />} />
              <Route path="reservas" element={<Reservas />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="caja" element={<Caja />} />
              <Route
                path="reportes"
                element={
                  <PrivateRoute clave="reportes_globales">
                    <Reportes />
                  </PrivateRoute>
                }
              />
              <Route path="leads" element={<Leads />} />

              {/* Módulos Nuevos */}
              <Route path="ocupacion" element={<Ocupacion />} />
              <Route path="actividad" element={<Actividad />} />
              <Route path="notificaciones" element={<Notificaciones />} />
              <Route path="comprobantes" element={<Comprobantes />} />
              <Route path="perfil" element={<Perfil />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/app/home" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

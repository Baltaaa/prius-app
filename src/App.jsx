import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CambiarContrasena from './pages/CambiarContrasena'
import PrivateRoute from './components/PrivateRoute'
import GlobalLoader from './components/ui/GlobalLoader'
import ScrollToTop from './components/ScrollToTop'
import { AuthProvider } from './context/AuthProvider'
import { PrivacidadProvider, usePrivacidad } from './context/PrivacidadProvider'
import { TemaProvider } from './context/TemaProvider'

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
const Configuracion = lazy(() => import('./pages/crm/Configuracion'))
const CajaResumen = lazy(() => import('./pages/CajaResumen'))
const Recepcion = lazy(() => import('./pages/Recepcion'))
const PlanoPublicoPreview = lazy(() => import('./pages/dev/PlanoPublicoPreview'))
const NotFound = lazy(() => import('./pages/crm/NotFound'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TemaProvider>
          <PrivacidadProvider>
            <Contenido />
          </PrivacidadProvider>
        </TemaProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

// Se suscribe al modo privacidad: al alternar el ojito vuelve a renderizar todo el árbol de
// rutas, así cada formatMonto() se recalcula con el estado nuevo sin recargar ni remontar nada.
function Contenido() {
  usePrivacidad()
  return (
    <>
        <ScrollToTop />
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

            {/* Resumen del cierre de un día: a donde llevan el botón del
                WhatsApp y el tap en la notificación push. Ruta propia, fuera
                de /app — se abre del celular para mirar un número y cerrar.
                Sin sesión, PrivateRoute guarda el deep link y vuelve acá. */}
            <Route
              path="/caja/:fecha/resumen"
              element={
                <PrivateRoute>
                  <CajaResumen />
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
              <Route path="recepcion" element={<Recepcion />} />
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
              {/* "Línea de Tiempo" se renombró a "Historial" (Tarea 7, oct
                  2026) — la ruta vieja /actividad queda redirigiendo para no
                  romper links guardados. */}
              <Route path="historial" element={<Actividad />} />
              <Route path="actividad" element={<Navigate to="/app/historial" replace />} />
              <Route path="notificaciones" element={<Notificaciones />} />
              <Route path="comprobantes" element={<Comprobantes />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="configuracion" element={<Configuracion />} />

              {/* Fase 4A, Tarea 5 (oct 2026): vista previa interna de la
                  variante pública del plano — herramienta de desarrollo,
                  solo superadmin (ver lib/permisos.ts). */}
              <Route
                path="dev/plano-publico"
                element={
                  <PrivateRoute clave="plano_publico_preview">
                    <PlanoPublicoPreview />
                  </PrivateRoute>
                }
              />

              {/* 404 real dentro del shell del CRM (sidebar/topbar
                  intactos) — antes cualquier ruta desconocida bajo /app
                  redirigía en silencio a Home sin avisar. */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Fuera de /app (no logueado o ruta top-level inexistente):
                sin sidebar, vuelve directo al Home. */}
            <Route path="*" element={<Navigate to="/app/home" replace />} />
          </Routes>
        </Suspense>
    </>
  )
}

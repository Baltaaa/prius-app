import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PrivateRoute from './components/PrivateRoute'

// Prius App Pages and Layouts
import AppLayout from './layouts/AppLayout'
import Home from './pages/crm/Home'
import Reservas from './pages/crm/Reservas'
import Clientes from './pages/crm/Clientes'
import Caja from './pages/crm/Caja'
import Reportes from './pages/crm/Reportes'
import Calendario from './pages/crm/Calendario'
import Notificaciones from './pages/crm/Notificaciones'
import Comprobantes from './pages/crm/Comprobantes'
import Perfil from './pages/crm/Perfil'

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
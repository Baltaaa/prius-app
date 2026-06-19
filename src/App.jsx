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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/" element={<Login />} />

        {/* New SPA Prius App Section */}
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
        </Route>

        {/* Fallback to default App route */}
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
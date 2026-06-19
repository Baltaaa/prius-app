import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PrivateRoute from './components/PrivateRoute'

// Prius CRM Pages and Layouts
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

        {/* Existing Interactive Playa Map */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />

        {/* New SPA Prius CRM Section */}
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
          <Route path="reservas" element={<Reservas />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="caja" element={<Caja />} />
          <Route path="reportes" element={<Reportes />} />
        </Route>

        {/* Fallback to Login/App */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
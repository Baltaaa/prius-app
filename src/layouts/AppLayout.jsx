import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/crm/Sidebar'
import TopBar from '../components/crm/TopBar'
import BottomNav from '../components/crm/BottomNav'
import { DataProvider } from '../context/DataProvider'
import { DialogProvider } from '../context/DialogProvider'

// Mobile-first (sept 2026): el Sidebar con drawer quedó solo para desktop —
// en mobile la navegación completa vive en BottomNav (5 ítems + "Más"), así
// que no hace falta abrir/cerrar nada acá arriba.
export default function AppLayout() {
  return (
    <DialogProvider>
      <DataProvider>
        <div className="h-screen w-screen flex text-white overflow-hidden">
          {/* Sidebar: solo desktop (oculto por completo en mobile, ver Sidebar.jsx) */}
          <Sidebar />

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
            <TopBar />

            {/* Content View with internal vertical scroll. Padding horizontal
                IDÉNTICO al del header (px-4 sm:px-6 md:px-8, ver TopBar.jsx)
                para que el borde de las tarjetas quede alineado con el ícono
                del título — nunca max-w/mx-auto acá, el contenido ocupa todo
                el ancho entre el sidebar y el borde derecho. Definido una
                sola vez acá: ninguna página debe agregar su propio
                max-w/px/mx-auto que lo contradiga. pb-20 en mobile deja lugar
                al BottomNav fijo (56px + safe-area) para que no tape contenido. */}
            <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 md:py-8 w-full pb-20 md:pb-12">
              <Outlet />
            </main>
          </div>

          <BottomNav />
        </div>
      </DataProvider>
    </DialogProvider>
  )
}

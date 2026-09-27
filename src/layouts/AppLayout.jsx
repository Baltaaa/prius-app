import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/crm/Sidebar'
import TopBar from '../components/crm/TopBar'
import { DataProvider } from '../context/DataProvider'
import { DialogProvider } from '../context/DialogProvider'

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <DialogProvider>
      <DataProvider>
        <div className="h-screen w-screen flex text-white overflow-hidden">
          {/* Sidebar: fijo en desktop, drawer deslizable en mobile */}
          <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
            <TopBar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

            {/* Content View with internal vertical scroll */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl w-full mx-auto pb-4 md:pb-12">
              <Outlet />
            </main>
          </div>
        </div>
      </DataProvider>
    </DialogProvider>
  )
}

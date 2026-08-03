import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/crm/Sidebar'
import TopBar from '../components/crm/TopBar'
import BottomNav from '../components/crm/BottomNav'

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen w-screen flex bg-white font-sans text-black overflow-hidden">
      {/* Desktop Fixed Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Content View with internal vertical scroll */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white max-w-7xl w-full mx-auto pb-20 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  )
}
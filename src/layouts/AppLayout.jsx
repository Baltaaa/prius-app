import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/crm/Sidebar'
import TopBar from '../components/crm/TopBar'
import BottomNav from '../components/crm/BottomNav'

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen w-screen flex bg-white font-sans text-black overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Content View */}
        <main className="flex-1 p-4 md:p-8 bg-white mb-16 md:mb-0 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  )
}
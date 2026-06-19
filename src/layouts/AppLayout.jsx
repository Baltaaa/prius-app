import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/crm/Sidebar'
import TopBar from '../components/crm/TopBar'
import BottomNav from '../components/crm/BottomNav'

export default function AppLayout() {
  return (
    <div className="h-screen w-screen flex bg-white font-sans text-black overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header Topbar */}
        <TopBar />

        {/* Content display */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 mt-14 md:mt-0 mb-[60px] md:mb-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  )
}
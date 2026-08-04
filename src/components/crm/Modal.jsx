import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4 backdrop-blur-md">
      <div className="bg-[#121212] w-full max-w-lg rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 text-white">
          <h2 className="text-xs uppercase font-bold tracking-wider text-[#F2CA50]">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-white">
          {children}
        </div>
      </div>
    </div>
  )
}
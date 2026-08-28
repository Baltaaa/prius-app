import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4 animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-lg rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <h2 className="text-sm uppercase font-bold tracking-[0.2em] text-[#FDE047]">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  )
}
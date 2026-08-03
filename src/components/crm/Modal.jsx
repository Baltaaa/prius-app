import React from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4 backdrop-blur-none">
      <div className="bg-white w-full max-w-lg rounded border border-[#E5E5E5] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] bg-black text-white">
          <h2 className="text-xs uppercase font-bold tracking-wider text-[#F2CA50]">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/20 rounded text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}
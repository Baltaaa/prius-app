import React from 'react'
import { Loader2 } from 'lucide-react'

export default function GlobalLoader({ message = "Sincronizando..." }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <div className="relative flex flex-col items-center">
        {/* Logo container with pulsing glow */}
        <div className="w-20 h-20 mb-8 relative">
          <div className="absolute inset-0 bg-gold/20 rounded-full animate-ping" />
          <div className="relative z-10 w-full h-full bg-white border border-gold/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(253,224,71,0.15)]">
            <img 
              src="/images/prius-icon.png" 
              alt="P" 
              className="w-10 h-10 object-contain"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-6 h-6 text-gold animate-spin" />
          <p className="text-[10px] font-bold text-gold uppercase tracking-[0.3em] animate-pulse">
            {message}
          </p>
        </div>

        {/* Decorative line */}
        <div className="mt-8 w-48 h-[1px] bg-prius-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FDE047] to-transparent w-24 animate-shimmer" />
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  )
}
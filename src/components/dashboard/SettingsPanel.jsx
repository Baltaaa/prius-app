import { X, User, LogOut } from "lucide-react"

export default function SettingsPanel({ user, onClose, onLogout }) {
  return (
    <div className="fixed inset-0 bg-prius-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md border border-hairline shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-hairline">
          <h2 className="text-lg font-normal uppercase tracking-tight">Configuración</h2>
          <button onClick={onClose} className="p-2 hover:bg-prius-background rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-prius-background border border-hairline rounded-sm">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center">
              <User className="w-5 h-5 text-prius-black" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Usuario Administrador</p>
              <p className="text-sm text-prius-black/60">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-4 bg-prius-black text-white rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-prius-black/90 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
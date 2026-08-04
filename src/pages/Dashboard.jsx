import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { 
  Printer, Settings, Search, Plus, Trash2, CheckSquare, Square, 
  Map, List, AlertCircle, Umbrella, Home, Check, Eye
} from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnitModal from "../components/dashboard/UnitModal"
import Cell from "../components/dashboard/Cell"
import GlobalLoader from "../components/ui/GlobalLoader"

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [units, setUnits] = useState({})
  const [viewMode, setViewMode] = useState("map")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    checkUser()
    initializeUnits()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate("/")
      return
    }
    setUser(session.user)
    setLoading(false)
  }

  const initializeUnits = () => {
    const savedUnits = localStorage.getItem("prius_beach_units")
    if (savedUnits) {
      setUnits(JSON.parse(savedUnits))
      return
    }
    const initialUnits = {}
    for (let i = 1; i <= 144; i++) {
      initialUnits[`C${i}`] = {
        id: `C${i}`, number: i, type: "carpa", status: STATUS.LIBRE,
        clientName: "", clientPhone: "", clientEmail: "",
        startDate: "", endDate: "", notes: "", isPaid: false, isTemporada: false
      }
    }
    for (let i = 1; i <= 40; i++) {
      initialUnits[`S${i}`] = {
        id: `S${i}`, number: i, type: "sombrilla", status: STATUS.LIBRE,
        clientName: "", clientPhone: "", clientEmail: "",
        startDate: "", endDate: "", notes: "", isPaid: false, isTemporada: false
      }
    }
    setUnits(initialUnits)
  }

  const handleUnitClick = (unit) => {
    if (unit) setSelectedUnit(unit)
  }

  const handleSaveUnit = (updatedUnit) => {
    const newUnits = { ...units, [updatedUnit.id]: updatedUnit }
    setUnits(newUnits)
    localStorage.setItem("prius_beach_units", JSON.stringify(newUnits))
    setSelectedUnit(null)
  }

  const getCarpa = (num) => units[`C${num}`]
  const getSombrilla = (num) => units[`S${num}`]

  const filteredUnitsList = Object.values(units).filter(u => 
    u.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.number.toString().includes(searchTerm)
  )

  return (
    <div className="h-full flex flex-col space-y-8 animate-premium-fade no-print">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Plano de Playa</h1>
          <p className="text-gray-400 text-sm mt-2">Gestión interactiva de unidades en tiempo real.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="glass-card p-1 rounded-xl flex">
            <button 
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === "map" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Mapa
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === "list" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Lista
            </button>
          </div>
          <button 
            onClick={() => window.print()}
            className="glass-card px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* Main content */}
      {viewMode === "map" ? (
        <div className="glass-card p-8 rounded-3xl glass-card-inner overflow-auto min-h-[600px] flex items-center justify-center">
          <div className="inline-block mx-auto transform scale-90 md:scale-100">
            {/* Cabecera del plano */}
            <div className="flex justify-center mb-12">
              <div className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                <div className="w-56 py-3 border border-white/5 text-center rounded-l-xl bg-white/5">Recreación</div>
                <div className="w-32 py-3 border-y border-white/5 text-center bg-white/5">Acceso</div>
                <div className="w-56 py-3 border border-white/5 text-center rounded-r-xl bg-sky-500/10 text-sky-400 border-sky-500/20">Sector Piscina</div>
              </div>
            </div>

            <div className="flex justify-center gap-8 relative">
              {/* Columnas de carpas */}
              {[
                { start: 1, end: 25 },
                { start: 26, end: 50 },
                { start: 51, end: 75 },
                { start: 76, end: 98 },
                { start: 99, end: 121 },
                { start: 122, end: 144 }
              ].map((col, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  {Array.from({ length: col.end - col.start + 1 }, (_, i) => col.start + i).map(num => (
                    <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                  ))}
                </div>
              ))}
            </div>

            {/* Sector Sombrillas */}
            <div className="mt-16 flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-6">Sector Sombrillas</span>
              <div className="grid grid-cols-2 gap-12">
                {[
                  [1, 6, 11, 16], [21, 26, 31, 36]
                ].map((starts, colIdx) => (
                  <div key={colIdx} className="space-y-1">
                    {starts.map(start => (
                      <div key={start} className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(off => (
                          <Cell key={start + off} number={start + off} unit={getSombrilla(start + off)} onClick={handleUnitClick} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 w-full bg-white/5 border border-white/5 py-4 text-center text-gray-500 font-bold text-[11px] tracking-[0.5em] uppercase rounded-xl">
              Océano Atlántico
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl overflow-hidden glass-card-inner">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <th className="px-8 py-5">Unidad</th>
                <th className="px-8 py-5">Cliente</th>
                <th className="px-8 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-300">
              {filteredUnitsList.map(unit => (
                <tr key={unit.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-8 py-5 font-bold text-white uppercase">{unit.type} #{unit.number}</td>
                  <td className="px-8 py-5 uppercase font-medium">{unit.clientName || 'Disponible'}</td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${unit.status === STATUS.LIBRE ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-[#FDE047]/10 text-[#FDE047] border border-[#FDE047]/20'}`}>
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => handleUnitClick(unit)} className="text-[#FDE047] hover:text-white font-bold text-xs uppercase underline-offset-4 hover:underline">
                      Administrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUnit && (
        <UnitModal unit={selectedUnit} onClose={() => setSelectedUnit(null)} onSave={handleSaveUnit} />
      )}
    </div>
  )
}
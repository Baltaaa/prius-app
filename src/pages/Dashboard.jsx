import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Printer, Plus, Minus, Maximize } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnitModal from "../components/dashboard/UnitModal"
import Cell from "../components/dashboard/Cell"

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [units, setUnits] = useState({})
  const [viewMode, setViewMode] = useState("map")
  const [zoom, setZoom] = useState(0.9)

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

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5))
  const handleResetZoom = () => setZoom(0.9)

  const getCarpa = (num) => units[`C${num}`]
  const getSombrilla = (num) => units[`S${num}`]

  return (
    <div className="h-full flex flex-col space-y-4 animate-premium-fade no-print overflow-hidden pb-4">
      {/* Header Section */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Plano de Playa</h1>
          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mt-1">Gestión de Unidades Prius Playa Grande</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card p-1 rounded-xl flex">
            <button onClick={() => setViewMode("map")} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${viewMode === "map" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}>Mapa</button>
            <button onClick={() => setViewMode("list")} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${viewMode === "list" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}>Lista</button>
          </div>
          <button onClick={() => window.print()} className="glass-card px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"><Printer size={14} /> Imprimir A4</button>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 min-h-0 glass-card rounded-3xl glass-card-inner relative overflow-hidden flex flex-col">
        {viewMode === "map" ? (
          <>
            {/* Zoom Controls */}
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
              <button onClick={handleZoomIn} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
                <Plus size={20} />
              </button>
              <button onClick={handleZoomOut} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
                <Minus size={20} />
              </button>
              <button onClick={handleResetZoom} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all" title="Reset Zoom">
                <Maximize size={18} />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-auto p-12 flex justify-center items-start">
              <div 
                className="transition-transform duration-200 origin-top"
                style={{ transform: `scale(${zoom})` }}
              >
                {/* Etiquetas Superiores - Ajustadas a la nueva arquitectura */}
                <div className="flex justify-center mb-10 gap-0">
                  <div className="w-[180px] py-3 border border-white/10 text-center rounded-l-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Recreación</div>
                  <div className="w-[80px] py-3 border-y border-x border-white/10 text-center bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white">Acceso</div>
                  <div className="w-[200px] py-3 border border-[#FDE047]/30 text-center rounded-r-lg bg-[#FDE047]/10 text-[9px] font-bold uppercase tracking-widest text-[#FDE047]">Sector Piscina</div>
                </div>

                {/* Grilla Principal Carpas con Pasillo Central */}
                <div className="flex justify-center gap-16 items-end pb-12">
                  
                  {/* Bloque Izquierda (1-25, 26-50, 51-75) */}
                  <div className="flex gap-8 items-end">
                    {[
                      { start: 1, count: 25 }, { start: 26, count: 25 }, { start: 51, count: 25 }
                    ].map((col, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        {Array.from({ length: col.count }, (_, i) => col.start + i).map(num => (
                          <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Pasillo Central (Espacio implícito por el gap-16) */}

                  {/* Bloque Derecha (Pileta + 76-98, 99-121, 122-144) */}
                  <div className="flex flex-col gap-0 items-center">
                    {/* El bloque de la Piscina */}
                    <div className="w-[180px] h-[72px] bg-sky-500/10 border border-sky-500/20 rounded-md mb-4 flex flex-col items-center justify-center relative group overflow-hidden">
                      <div className="absolute inset-0 bg-sky-400/5" />
                      <span className="relative z-10 text-[10px] font-black text-sky-400 uppercase tracking-[0.6em]">Pileta</span>
                      <div className="w-12 h-1 bg-sky-400/20 rounded-full mt-2" />
                    </div>
                    
                    <div className="flex gap-8 items-end">
                      {[
                        { start: 76, count: 23 }, { start: 99, count: 23 }, { start: 122, count: 23 }
                      ].map((col, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          {Array.from({ length: col.count }, (_, i) => col.start + i).map(num => (
                            <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sector Sombrillas */}
                <div className="mt-16 flex flex-col items-center">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-[1px] w-12 bg-white/10" />
                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-500">Sector Sombrillas</span>
                    <div className="h-[1px] w-12 bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-20">
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

                <div className="mt-16 w-full bg-white/5 border border-white/5 py-5 text-center text-gray-600 font-black text-[11px] tracking-[1em] uppercase rounded-2xl">
                  Océano Atlántico
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full overflow-auto p-6">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0a0d14] z-10">
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <th className="px-6 py-4">Unidad</th>
                  <th className="px-6 py-4">Titular</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.values(units).map(unit => (
                  <tr key={unit.id} className="hover:bg-white/5 text-xs text-gray-300">
                    <td className="px-6 py-4 font-bold uppercase">{unit.type} #{unit.number}</td>
                    <td className="px-6 py-4 uppercase">{unit.clientName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${unit.status === STATUS.LIBRE ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-[#FDE047]/10 text-[#FDE047] border-[#FDE047]/20'}`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleUnitClick(unit)} className="text-[#FDE047] font-bold text-[10px] uppercase hover:underline">Administrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUnit && <UnitModal unit={selectedUnit} onClose={() => setSelectedUnit(null)} onSave={handleSaveUnit} />}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
        .overflow-auto::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .overflow-auto::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .overflow-auto::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background: #FDE047;
        }
      `}</style>
    </div>
  )
}
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Printer } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnitModal from "../components/dashboard/UnitModal"
import Cell from "../components/dashboard/Cell"

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [units, setUnits] = useState({})
  const [viewMode, setViewMode] = useState("map")

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

  const getCarpa = (num) => units[`C${num}`]
  const getSombrilla = (num) => units[`S${num}`]

  return (
    <div className="h-full flex flex-col space-y-4 animate-premium-fade no-print overflow-hidden">
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

      {/* Workspace */}
      <div className="flex-1 min-h-0 glass-card rounded-3xl glass-card-inner flex items-center justify-center relative overflow-hidden p-6">
        {viewMode === "map" ? (
          <div className="transform scale-[0.65] lg:scale-[0.85] xl:scale-[0.95] origin-center transition-transform duration-500">
            {/* Etiquetas Superiores */}
            <div className="flex justify-center mb-8 gap-1">
              <div className="w-[124px] py-2 border border-white/10 text-center rounded-l-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Recreación</div>
              <div className="w-[62px] py-2 border border-white/10 text-center bg-white/5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Acceso</div>
              <div className="w-[200px] py-2 border border-[#FDE047]/30 text-center rounded-r-lg bg-[#FDE047]/10 text-[9px] font-bold uppercase tracking-widest text-[#FDE047]">Sector Piscina</div>
            </div>

            {/* Grilla Principal Carpas */}
            <div className="flex justify-center gap-8 items-end">
              {/* Pasillos 1, 2, 3 (Completos 25u) */}
              {[
                { start: 1, count: 25 }, { start: 26, count: 25 }, { start: 51, count: 25 }
              ].map((col, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  {Array.from({ length: col.count }, (_, i) => col.start + i).map(num => (
                    <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                  ))}
                </div>
              ))}

              {/* Grupo Pool (Empujado por el Sector Piscina) */}
              <div className="flex flex-col gap-0.5 items-center">
                 {/* El "Mueble" de la Piscina que empuja hacia abajo */}
                 <div className="w-[170px] h-[58px] bg-white/5 border border-white/10 rounded-sm mb-4 flex items-center justify-center relative group overflow-hidden">
                    <div className="absolute inset-0 bg-sky-500/5 group-hover:bg-sky-500/10 transition-colors" />
                    <span className="relative z-10 text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em]">Pileta</span>
                 </div>
                 
                 <div className="flex gap-8 items-end">
                    {[
                      { start: 76, count: 23 }, { start: 99, count: 23 }, { start: 122, count: 23 }
                    ].map((col, idx) => (
                      <div key={idx} className="flex flex-col gap-0.5">
                        {Array.from({ length: col.count }, (_, i) => col.start + i).map(num => (
                          <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                        ))}
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Sombrillas */}
            <div className="mt-12 flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500 mb-6">Sector Sombrillas</span>
              <div className="grid grid-cols-2 gap-16">
                {[
                  [1, 6, 11, 16], [21, 26, 31, 36]
                ].map((starts, colIdx) => (
                  <div key={colIdx} className="space-y-0.5">
                    {starts.map(start => (
                      <div key={start} className="flex gap-0.5">
                        {[0, 1, 2, 3, 4].map(off => (
                          <Cell key={start + off} number={start + off} unit={getSombrilla(start + off)} onClick={handleUnitClick} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 w-full bg-white/5 border border-white/5 py-4 text-center text-gray-500 font-bold text-[10px] tracking-[0.8em] uppercase rounded-xl">Océano Atlántico</div>
          </div>
        ) : (
          <div className="w-full h-full overflow-auto p-4">
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
      <style>{`@media print {@page {size: A4; margin:0;} body {background:white!important; color:black!important;} .no-print {display:none!important;}}`}</style>
    </div>
  )
}
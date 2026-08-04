import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Printer, Map, List } from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnitModal from "../components/dashboard/UnitModal"
import Cell from "../components/dashboard/Cell"

export default function Dashboard() {
  const navigate = useNavigate()
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

  const occupiedUnits = Object.values(units).filter(u => u.status !== STATUS.LIBRE)

  return (
    <div className="h-full flex flex-col space-y-4 animate-premium-fade pb-4 overflow-hidden">
      {/* Header Section - No Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Plano de Playa</h1>
          <p className="text-gray-400 text-xs mt-1">Gestión interactiva de unidades en tiempo real.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="glass-card p-1 rounded-xl flex">
            <button 
              onClick={() => setViewMode("map")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "map" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Mapa
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === "list" ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Lista
            </button>
          </div>
          <button 
            onClick={() => window.print()}
            className="glass-card px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Printer size={14} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Main content - Pantalla */}
      <div className="flex-1 min-h-0 overflow-hidden no-print">
        {viewMode === "map" ? (
          <div className="glass-card h-full rounded-3xl glass-card-inner flex items-center justify-center p-4 relative overflow-hidden">
            {/* El plano escalado para entrar siempre en pantalla */}
            <div className="transform scale-[0.65] lg:scale-[0.8] xl:scale-[0.9] origin-center transition-transform duration-500">
              <div className="flex justify-center mb-8">
                <div className="flex text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  <div className="w-40 py-2 border border-white/5 text-center rounded-l-xl bg-white/5">Recreación</div>
                  <div className="w-24 py-2 border-y border-white/5 text-center bg-white/5">Acceso</div>
                  <div className="w-40 py-2 border border-white/5 text-center rounded-r-xl bg-sky-500/10 text-sky-400 border-sky-500/20">Sector Piscina</div>
                </div>
              </div>

              <div className="flex justify-center gap-6 relative">
                {[
                  { start: 1, end: 25 }, { start: 26, end: 50 }, { start: 51, end: 75 },
                  { start: 76, end: 98 }, { start: 99, end: 121 }, { start: 122, end: 144 }
                ].map((col, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5">
                    {Array.from({ length: col.end - col.start + 1 }, (_, i) => col.start + i).map(num => (
                      <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} />
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-12 flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-4">Sector Sombrillas</span>
                <div className="grid grid-cols-2 gap-8">
                  {[[1, 6, 11, 16], [21, 26, 31, 36]].map((starts, colIdx) => (
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

              <div className="mt-8 w-full bg-white/5 border border-white/5 py-3 text-center text-gray-500 font-bold text-[9px] tracking-[0.5em] uppercase rounded-xl">
                Océano Atlántico
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card h-full rounded-3xl overflow-auto glass-card-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500 sticky top-0 bg-[#0a0d14]">
                  <th className="px-8 py-4">Unidad</th>
                  <th className="px-8 py-4">Cliente</th>
                  <th className="px-8 py-4">Estado</th>
                  <th className="px-8 py-4 text-right">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {Object.values(units).map(unit => (
                  <tr key={unit.id} className="hover:bg-white/5 transition-all">
                    <td className="px-8 py-3 font-bold text-white uppercase">{unit.type} #{unit.number}</td>
                    <td className="px-8 py-3 uppercase font-medium">{unit.clientName || 'Disponible'}</td>
                    <td className="px-8 py-3">
                      <span className={`px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${unit.status === STATUS.LIBRE ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-[#FDE047]/10 text-[#FDE047] border border-[#FDE047]/20'}`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-8 py-3 text-right">
                      <button onClick={() => handleUnitClick(unit)} className="text-[#FDE047] hover:text-white font-bold text-[10px] uppercase underline-offset-4 hover:underline">
                        Administrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VISTA DE IMPRESIÓN (OCULTA EN UI) */}
      <div className="hidden print:block print:bg-white print:text-black print:p-0 print:m-0 w-full">
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Prius Playa Grande</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Estado General de Unidades — Temporada 2025/2026</p>
            </div>
            <div className="text-right text-[10px] font-bold">
              <p>FECHA: {new Date().toLocaleDateString()}</p>
              <p>HORA: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Plano de Playa para impresión (Escalado A4) */}
          <div className="flex flex-col items-center scale-[0.75] origin-top">
             {/* Estructura del plano simplificada para impresión */}
             <div className="flex justify-center gap-4">
                {[1, 26, 51, 76, 99, 122].map((startNum, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5">
                    {Array.from({ length: idx < 3 ? 25 : 23 }, (_, i) => startNum + i).map(num => {
                      const u = getCarpa(num);
                      const isOcc = u?.status !== STATUS.LIBRE;
                      return (
                        <div key={num} className={`w-6 h-4 border border-black flex items-center justify-center text-[7px] font-bold ${isOcc ? 'bg-black text-white' : ''}`}>
                          {num}
                        </div>
                      )
                    })}
                  </div>
                ))}
             </div>
             <div className="mt-8 grid grid-cols-8 gap-1">
                {Array.from({ length: 40 }, (_, i) => i + 1).map(num => {
                  const u = getSombrilla(num);
                  const isOcc = u?.status !== STATUS.LIBRE;
                  return (
                    <div key={num} className={`w-8 h-6 border border-black flex items-center justify-center text-[7px] font-bold ${isOcc ? 'bg-black text-white' : ''}`}>
                      S{num}
                    </div>
                  )
                })}
             </div>
          </div>

          {/* Listado de Periodos / Ocupación */}
          <div className="mt-12">
            <h2 className="text-xs font-black uppercase tracking-widest border-b border-black mb-4">Detalle de Unidades Ocupadas</h2>
            <table className="w-full text-left border-collapse text-[9px]">
              <thead>
                <tr className="border-b border-black font-bold uppercase">
                  <th className="py-2">Unidad</th>
                  <th className="py-2">Titular / Cliente</th>
                  <th className="py-2">Periodo / Tipo</th>
                  <th className="py-2 text-right">Estado Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {occupiedUnits.map(u => (
                  <tr key={u.id}>
                    <td className="py-1.5 font-bold uppercase">{u.type} #{u.number}</td>
                    <td className="py-1.5 uppercase">{u.clientName || 'S/N'}</td>
                    <td className="py-1.5 uppercase">
                      {u.isTemporada ? 'Temporada Completa' : `${u.startDate} al ${u.endDate}`}
                    </td>
                    <td className="py-1.5 text-right font-bold uppercase">{u.isPaid ? 'Pagado' : 'Pendiente'}</td>
                  </tr>
                ))}
                {occupiedUnits.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500 italic">No hay unidades ocupadas en este momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="fixed bottom-8 left-8 right-8 text-center border-t border-gray-200 pt-4 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
            Documento interno generado por PriusAdmin Playa Grande.
          </div>
        </div>
      </div>

      {selectedUnit && (
        <UnitModal unit={selectedUnit} onClose={() => setSelectedUnit(null)} onSave={handleSaveUnit} />
      )}

      {/* Estilos CSS específicos para forzar el fit en pantalla y la impresión A4 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          body { overflow: hidden; }
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-block { display: block !important; }
        }
      `}} />
    </div>
  )
}
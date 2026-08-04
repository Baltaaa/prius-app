import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { 
  Printer, Settings, Search, Plus, Trash2, CheckSquare, Square, 
  Map, List, AlertCircle, Umbrella, Home, Check, Eye
} from "lucide-react"

import { STATUS } from "../components/dashboard/constants"
import UnitModal from "../components/dashboard/UnitModal"
import SettingsPanel from "../components/dashboard/SettingsPanel"
import Cell from "../components/dashboard/Cell"
import GlobalLoader from "../components/ui/GlobalLoader"

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [units, setUnits] = useState({})
  const [viewMode, setViewMode] = useState("map") // "map" o "list"
  
  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // "all", "libre", "temporada", "periodo"
  const [paymentFilter, setPaymentFilter] = useState("all") // "all", "paid", "unpaid"
  const [typeFilter, setTypeFilter] = useState("all") // "all", "carpa", "sombrilla"

  // Tareas del Día (To-Do List)
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem("prius_todos")
    return saved ? JSON.parse(saved) : [
      { id: 1, text: "Revisar carpa #12 (mantenimiento lona)", completed: false },
      { id: 2, text: "Cobrar saldo pendiente sombrilla #5", completed: false }
    ]
  })
  const [newTodo, setNewTodo] = useState("")

  useEffect(() => {
    checkUser()
    initializeUnits()
  }, [])

  useEffect(() => {
    localStorage.setItem("prius_todos", JSON.stringify(todos))
  }, [todos])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate("/login")
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
    
    // Unidades de ejemplo pre-cargadas
    initialUnits[`C12`] = {
      id: `C12`, number: 12, type: "carpa", status: STATUS.TEMPORADA,
      clientName: "CARLOS PÉREZ", clientPhone: "+542235551234", clientEmail: "carlos@perez.com",
      startDate: "", endDate: "", notes: "Solicitó reposeras extra", isPaid: true, isTemporada: true
    }
    initialUnits[`C25`] = {
      id: `C25`, number: 25, type: "carpa", status: STATUS.PERIODO,
      clientName: "MARÍA GONZÁLEZ", clientPhone: "+542235559876", clientEmail: "maria@gonzalez.com",
      startDate: "2025-01-15", endDate: "2025-01-30", notes: "Frente a pasillo principal", isPaid: false, isTemporada: false
    }
    initialUnits[`S5`] = {
      id: `S5`, number: 5, type: "sombrilla", status: STATUS.PERIODO,
      clientName: "JUAN RODRÍGUEZ", clientPhone: "+541144445555", clientEmail: "juan@rodriguez.com",
      startDate: "2025-01-10", endDate: "2025-01-20", notes: "Cerca de la piscina", isPaid: false, isTemporada: false
    }

    for (let i = 1; i <= 40; i++) {
      if (!initialUnits[`S${i}`]) {
        initialUnits[`S${i}`] = {
          id: `S${i}`, number: i, type: "sombrilla", status: STATUS.LIBRE,
          clientName: "", clientPhone: "", clientEmail: "",
          startDate: "", endDate: "", notes: "", isPaid: false, isTemporada: false
        }
      }
    }
    setUnits(initialUnits)
    localStorage.setItem("prius_beach_units", JSON.stringify(initialUnits))
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

  const isUnitMatchingSearch = (unit) => {
    if (!unit) return false
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true

    if (unit.id.toLowerCase().includes(term) || unit.number.toString() === term) return true
    if (unit.clientName?.toLowerCase().includes(term)) return true
    if (unit.clientPhone?.includes(term)) return true
    if (unit.clientEmail?.toLowerCase().includes(term)) return true
    if (unit.notes?.toLowerCase().includes(term)) return true

    return false
  }

  const isUnitMatchingFilters = (unit) => {
    if (!unit) return false

    if (typeFilter !== "all" && unit.type !== typeFilter) return false
    if (statusFilter !== "all" && unit.status !== statusFilter) return false

    if (paymentFilter !== "all") {
      if (paymentFilter === "paid" && !unit.isPaid) return false
      if (paymentFilter === "unpaid" && unit.isPaid) return false
      if (paymentFilter === "unpaid" && unit.status === STATUS.LIBRE) return false
    }

    return true
  }

  const handleAddTodo = (e) => {
    e.preventDefault()
    if (!newTodo.trim()) return
    setTodos(prev => [...prev, { id: Date.now(), text: newTodo.trim(), completed: false }])
    setNewTodo("")
  }

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const stats = {
    carpasLibres: Object.values(units).filter(u => u.type === "carpa" && u.status === STATUS.LIBRE).length,
    carpasOcupadas: Object.values(units).filter(u => u.type === "carpa" && u.status !== STATUS.LIBRE).length,
    sombrillasLibres: Object.values(units).filter(u => u.type === "sombrilla" && u.status === STATUS.LIBRE).length,
    sombrillasOcupadas: Object.values(units).filter(u => u.type === "sombrilla" && u.status !== STATUS.LIBRE).length,
  }

  const filteredUnitsList = Object.values(units).filter(u => isUnitMatchingSearch(u) && isUnitMatchingFilters(u))

  const formatDate = (dateStr) => {
    if (!dateStr) return ""
    const parts = dateStr.split("-")
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`
    }
    return dateStr
  }

  const renderPrintCarpaCell = (unit, numberOnLeft = true) => {
    if (!unit) return <div className="w-[42px] h-[11px]" />
    const status = unit.status || STATUS.LIBRE
    const isTemporada = status === STATUS.TEMPORADA
    const isPeriodo = status === STATUS.PERIODO
    return (
      <div key={unit.id} className="flex items-center justify-between w-[42px] h-[11px]">
        {numberOnLeft ? (
          <>
            <span className="text-[7px] font-normal text-black w-4 text-right pr-1">{unit.number}</span>
            <div className={`w-[18px] h-[10px] border border-black flex items-center justify-center text-[7px] font-bold ${isTemporada ? 'bg-neutral-300 text-black' : isPeriodo ? 'bg-neutral-100 text-black' : 'bg-white'}`}>
              {isTemporada && "T"}
              {isPeriodo && "P"}
            </div>
          </>
        ) : (
          <>
            <div className={`w-[18px] h-[10px] border border-black flex items-center justify-center text-[7px] font-bold ${isTemporada ? 'bg-neutral-300 text-black' : isPeriodo ? 'bg-neutral-100 text-black' : 'bg-white'}`}>
              {isTemporada && "T"}
              {isPeriodo && "P"}
            </div>
            <span className="text-[7px] font-normal text-black w-4 text-left pl-1">{unit.number}</span>
          </>
        )}
      </div>
    )
  }

  const renderPrintSombrillaCell = (unit) => {
    if (!unit) return null
    const status = unit.status || STATUS.LIBRE
    const isTemporada = status === STATUS.TEMPORADA
    const isPeriodo = status === STATUS.PERIODO
    return (
      <div key={unit.id} className="flex items-center gap-1 w-[38px] h-[11px]">
        <div className={`w-[14px] h-[10px] border border-black flex items-center justify-center text-[6.5px] font-bold ${isTemporada ? 'bg-neutral-300 text-black' : isPeriodo ? 'bg-neutral-100 text-black' : 'bg-white'}`}>
          {isTemporada && "T"}
          {isPeriodo && "P"}
        </div>
        <span className="text-[7px] font-normal text-black">{unit.number}</span>
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col bg-white text-black overflow-hidden animate-premium-fade no-print">
        
        {/* Title & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5]">
          <div>
            <h1 className="text-base font-bold text-black tracking-tight uppercase">Plano de Playa</h1>
            <p className="text-[11px] text-neutral-500 font-normal">Distribución interactiva de carpas y sombrillas.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#F9F9F9] border border-[#E5E5E5] p-1 rounded-sm">
              <button 
                onClick={() => setViewMode("map")}
                className={`px-3 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === "map" ? 'bg-black text-[#F2CA50]' : 'text-neutral-600 hover:text-black'}`}
              >
                <Map className="w-3.5 h-3.5" />
                Mapa
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === "list" ? 'bg-black text-[#F2CA50]' : 'text-neutral-600 hover:text-black'}`}
              >
                Lista ({filteredUnitsList.length})
              </button>
            </div>

            <button 
              onClick={() => window.print()} 
              className="px-3 py-1.5 border border-[#E5E5E5] hover:bg-black hover:text-white rounded-sm text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5" 
              title="Imprimir Plano"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden mt-3">
          {/* Main Content Map Container */}
          <main className="flex-1 overflow-auto pr-0 lg:pr-3">
            {viewMode === "map" ? (
              /* VISTA DE MAPA */
              <div className="bg-[#F9F9F9] border border-[#E5E5E5] p-3 md:p-4 rounded-sm max-w-full overflow-auto">
                <div className="mx-auto" style={{ maxWidth: "880px" }}>
                  <div className="flex justify-center mb-2">
                    <div className="flex text-[9px] font-bold uppercase tracking-widest font-display">
                      <div className="w-[240px] bg-white py-1 text-center border border-[#E5E5E5]">Recreación</div>
                      <div className="w-[120px] bg-white py-1 text-center border-y border-[#E5E5E5]">Acceso</div>
                      <div className="w-[240px] relative">
                        <div className="absolute inset-x-0 top-0 h-[70px] bg-[#E5E5E5]/50 text-black border border-[#E5E5E5] rounded-sm flex items-center justify-center z-20 font-bold">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Sector Piscina</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-2 md:gap-3 relative mt-10">
                    {/* Pasillo A */}
                    <div className="flex gap-6 md:gap-8">
                      <div className="flex flex-col gap-[2px]">
                        {Array.from({ length: 25 }, (_, i) => i + 1).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                      <div className="flex flex-col gap-[2px]">
                        {Array.from({ length: 25 }, (_, i) => i + 26).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                    </div>

                    <div className="w-px bg-[#E5E5E5] mx-1.5" />

                    {/* Pasillo B */}
                    <div className="flex gap-6 md:gap-8">
                      <div className="flex flex-col gap-[2px]">
                        {Array.from({ length: 25 }, (_, i) => i + 51).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                      <div className="flex flex-col gap-[2px] relative">
                        <div className="h-[22px]" /><div className="h-[22px]" />
                        {Array.from({ length: 23 }, (_, i) => i + 76).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                    </div>

                    <div className="w-px bg-[#E5E5E5] mx-1.5" />

                    {/* Pasillo C */}
                    <div className="flex gap-6 md:gap-8">
                      <div className="flex flex-col gap-[2px]">
                        <div className="h-[22px]" /><div className="h-[22px]" />
                        {Array.from({ length: 23 }, (_, i) => i + 99).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                      <div className="flex flex-col gap-[2px]">
                        <div className="h-[22px]" /><div className="h-[22px]" />
                        {Array.from({ length: 23 }, (_, i) => i + 122).map(num => {
                          const unit = getCarpa(num)
                          const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                          return (
                            <Cell 
                              key={num} 
                              number={num} 
                              unit={unit} 
                              onClick={handleUnitClick} 
                              isHighlighted={searchTerm && isMatch}
                              isDimmed={searchTerm && !isMatch}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sombrillas */}
                  <div className="mt-6 flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Sector Sombrillas</span>
                    <div className="flex gap-8 justify-center">
                      <div className="flex flex-col gap-[2px]">
                        {[
                          [1, 2, 3, 4, 5],
                          [6, 7, 8, 9, 10],
                          [11, 12, 13, 14, 15],
                          [16, 17, 18, 19, 20]
                        ].map((row, rowIdx) => (
                          <div key={`left-row-${rowIdx}`} className="flex gap-1">
                            {row.map(num => {
                              const unit = getSombrilla(num)
                              const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                              return (
                                <Cell 
                                  key={num} 
                                  number={num} 
                                  unit={unit} 
                                  onClick={handleUnitClick} 
                                  isHighlighted={searchTerm && isMatch}
                                  isDimmed={searchTerm && !isMatch}
                                />
                              )
                            })}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-[2px]">
                        {[
                          [21, 22, 23, 24, 25],
                          [26, 27, 28, 29, 30],
                          [31, 32, 33, 34, 35],
                          [36, 37, 38, 39, 40]
                        ].map((row, rowIdx) => (
                          <div key={`right-row-${rowIdx}`} className="flex gap-1">
                            {row.map(num => {
                              const unit = getSombrilla(num)
                              const isMatch = isUnitMatchingSearch(unit) && isUnitMatchingFilters(unit)
                              return (
                                <Cell 
                                  key={num} 
                                  number={num} 
                                  unit={unit} 
                                  onClick={handleUnitClick} 
                                  isHighlighted={searchTerm && isMatch}
                                  isDimmed={searchTerm && !isMatch}
                                />
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <div className="w-full max-w-[480px] bg-black py-2 text-center text-white font-bold text-[9px] tracking-[0.3em] uppercase">
                      Mar Argentino
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* VISTA DE LISTA / TABLA */
              <div className="bg-white border border-[#E5E5E5] rounded-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F9F9F9] text-black text-[10px] font-bold uppercase tracking-wider border-b border-[#E5E5E5]">
                      <th className="p-3">Unidad</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Estadía</th>
                      <th className="p-3">Estado Pago</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] text-xs">
                    {filteredUnitsList.map((unit) => (
                      <tr key={unit.id} className="hover:bg-[#F9F9F9] transition-colors">
                        <td className="p-3 font-bold flex items-center gap-2">
                          <span className="uppercase">{unit.type} #{unit.number}</span>
                        </td>
                        <td className="p-3">
                          {unit.clientName ? (
                            <span className="font-bold uppercase">{unit.clientName}</span>
                          ) : (
                            <span className="text-neutral-300 italic uppercase">Disponible</span>
                          )}
                        </td>
                        <td className="p-3">
                          {unit.status === STATUS.LIBRE ? (
                            <span className="text-green-600 font-bold uppercase text-[9px] tracking-wider">Libre</span>
                          ) : unit.isTemporada ? (
                            <span className="bg-black text-white px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider">Temporada</span>
                          ) : (
                            <span className="bg-[#F2CA50]/20 text-black px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider">
                              {unit.startDate} al {unit.endDate}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {unit.status === STATUS.LIBRE ? (
                            <span className="text-neutral-300 uppercase font-bold text-[9px]">-</span>
                          ) : unit.isPaid ? (
                            <span className="text-green-600 font-bold uppercase text-[9px] tracking-wider">PAGADO</span>
                          ) : (
                            <span className="text-red-500 font-bold uppercase text-[9px] tracking-wider">PENDIENTE</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => handleUnitClick(unit)}
                            className="px-2.5 py-1 bg-black text-white hover:bg-[#F2CA50] hover:text-black rounded-sm font-bold text-[9px] uppercase tracking-wider transition-colors"
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          {/* Sidebar / Bento Grid Aside right for filters and metrics */}
          <aside className="w-full lg:w-60 pl-0 lg:pl-3 pt-3 lg:pt-0 space-y-3 shrink-0 lg:overflow-y-auto">
            {/* Bento Filter Box */}
            <div className="p-3 border border-[#E5E5E5] bg-white rounded-sm space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Filtros Rápidos</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Tipo</label>
                  <select 
                    value={typeFilter} 
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full border border-[#E5E5E5] rounded-sm py-1 px-2 text-xs outline-none bg-transparent"
                  >
                    <option value="all">TODOS</option>
                    <option value="carpa">CARPAS</option>
                    <option value="sombrilla">SOMBRILLAS</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">Estado de Reserva</label>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full border border-[#E5E5E5] rounded-sm py-1 px-2 text-xs outline-none bg-transparent"
                  >
                    <option value="all">TODOS</option>
                    <option value="libre">DISPONIBLES</option>
                    <option value="temporada">TEMPORADA COMPLETA</option>
                    <option value="periodo">POR PERÍODO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bento Statistics Box */}
            <div className="p-3 border border-[#E5E5E5] bg-white rounded-sm space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Resumen Unidades</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-black text-white rounded-sm flex flex-col justify-between">
                  <p className="text-base font-bold">{stats.carpasOcupadas}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Carpas Ocupadas</p>
                </div>
                <div className="p-2 bg-white border border-[#E5E5E5] rounded-sm flex flex-col justify-between">
                  <p className="text-base font-bold text-black">{stats.carpasLibres}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Carpas Libres</p>
                </div>
              </div>
            </div>

            {/* Bento Tareas Box */}
            <div className="p-3 border border-[#E5E5E5] bg-white rounded-sm space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 flex items-center justify-between">
                <span>Tareas de la Fecha</span>
              </h3>
              
              <form onSubmit={handleAddTodo} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nueva tarea..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  className="flex-1 px-2 py-1 border border-[#E5E5E5] rounded-sm text-xs focus:border-black outline-none"
                />
                <button type="submit" className="px-2 bg-black text-[#F2CA50] hover:bg-black/90 rounded-sm">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-start justify-between gap-2 p-1.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-sm text-xs">
                    <button type="button" onClick={() => toggleTodo(todo.id)}>
                      {todo.completed ? <CheckSquare className="w-3.5 h-3.5 text-green-600" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                    <span className={`flex-1 leading-tight text-[10px] uppercase ${todo.completed ? 'line-through opacity-40' : 'text-neutral-700'}`}>
                      {todo.text}
                    </span>
                    <button type="button" onClick={() => deleteTodo(todo.id)}>
                      <Trash2 className="w-3 h-3 text-neutral-400 hover:text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {selectedUnit && (
          <UnitModal
            unit={selectedUnit}
            onClose={() => setSelectedUnit(null)}
            onSave={handleSaveUnit}
          />
        )}
      </div>

      {/* VISTA DE IMPRESIÓN EXCLUSIVA */}
      <div className="hidden print:block bg-white text-black p-2 w-full h-full font-sans leading-tight">
        <div className="text-center mb-1">
          <h1 className="text-[11px] font-bold uppercase tracking-wider">Plano General Temporada 25-26</h1>
          <div className="h-[2px] bg-black mt-0.5"></div>
        </div>

        <div className="grid grid-cols-3 text-center font-bold text-[7px] uppercase border border-black bg-gray-100 py-0.5 mb-1">
          <div>Recreación</div>
          <div>Acceso</div>
          <div>Piscina</div>
        </div>

        <div className="flex justify-center gap-6 text-[7px] mb-2">
          <div className="flex flex-col gap-[1px]">
            {Array.from({ length: 25 }, (_, i) => i + 1).map(num => renderPrintCarpaCell(getCarpa(num), true))}
          </div>

          <div className="flex gap-0">
            <div className="flex flex-col gap-[1px]">
              {Array.from({ length: 25 }, (_, i) => i + 26).map(num => renderPrintCarpaCell(getCarpa(num), true))}
            </div>
            <div className="flex flex-col gap-[1px]">
              {Array.from({ length: 25 }, (_, i) => i + 51).map(num => renderPrintCarpaCell(getCarpa(num), false))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="w-[84px] h-[23px] bg-sky-100 border border-black flex items-center justify-center text-[6px] font-bold mb-[1px]">
              PILETA
            </div>
            <div className="flex gap-0">
              <div className="flex flex-col gap-[1px]">
                {Array.from({ length: 23 }, (_, i) => i + 76).map(num => renderPrintCarpaCell(getCarpa(num), true))}
              </div>
              <div className="flex flex-col gap-[1px]">
                {Array.from({ length: 23 }, (_, i) => i + 99).map(num => renderPrintCarpaCell(getCarpa(num), false))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[1px]">
            <div className="h-[23px] border border-transparent" />
            {Array.from({ length: 23 }, (_, i) => i + 122).map(num => renderPrintCarpaCell(getCarpa(num), false))}
          </div>
        </div>

        <div className="border-[1.5px] border-black p-1 mb-1.5">
          <div className="flex justify-around gap-2">
            <div className="grid grid-cols-5 gap-x-1.5 gap-y-[1px]">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(num => renderPrintSombrillaCell(getSombrilla(num)))}
            </div>
            <div className="grid grid-cols-5 gap-x-1.5 gap-y-[1px]">
              {Array.from({ length: 20 }, (_, i) => i + 21).map(num => renderPrintSombrillaCell(getSombrilla(num)))}
            </div>
          </div>
        </div>

        <div className="bg-black text-white text-center font-bold text-[7px] py-0.5 tracking-[0.3em] uppercase mb-2">
          Mar Argentino
        </div>

        <div className="grid grid-cols-2 gap-4 text-[6.5px] leading-tight border-t border-gray-200 pt-1.5">
          <div className="space-y-[1px]">
            <p className="font-bold uppercase text-[7px] border-b border-black pb-[1px] mb-1">Carpas</p>
            {Object.values(units)
              .filter(u => u.type === "carpa" && u.status !== STATUS.LIBRE)
              .sort((a, b) => a.number - b.number)
              .map(u => {
                const formattedDates = u.startDate && u.endDate 
                  ? `${formatDate(u.startDate)} AL ${formatDate(u.endDate)}`
                  : u.status === STATUS.TEMPORADA ? "TEMPORADA" : ""
                return (
                  <div key={u.id} className="flex gap-1">
                    <span className="font-bold min-w-[24px]">C.{u.number}</span>
                    <span className="uppercase truncate">{u.clientName || "OCUPADO"} {formattedDates && `(${formattedDates})`}</span>
                  </div>
                )
              })}
          </div>

          <div className="space-y-[1px]">
            <p className="font-bold uppercase text-[7px] border-b border-black pb-[1px] mb-1">Sombrillas</p>
            {Object.values(units)
              .filter(u => u.type === "sombrilla" && u.status !== STATUS.LIBRE)
              .sort((a, b) => a.number - b.number)
              .map(u => {
                const formattedDates = u.startDate && u.endDate 
                  ? `${formatDate(u.startDate)} AL ${formatDate(u.endDate)}`
                  : u.status === STATUS.TEMPORADA ? "TEMPORADA" : ""
                return (
                  <div key={u.id} className="flex gap-1">
                    <span className="font-bold min-w-[24px]">S.{u.number}</span>
                    <span className="uppercase truncate">{u.clientName || "OCUPADO"} {formattedDates && `(${formattedDates})`}</span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.4cm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </>
  )
}
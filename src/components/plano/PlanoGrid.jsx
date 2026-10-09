import { PLANO_PASILLO_CENTRAL, PLANO_SECTOR_WIDTH, PLANO_BLOQUE_GAP, CARPAS_LAYOUT, SOMBRILLAS_LAYOUT } from "./planoLayout"

function* rango([desde, hasta]) {
  for (let n = desde; n <= hasta; n++) yield n
}

function indexar(unidades) {
  const map = new Map()
  for (const u of unidades || []) map.set(`${u.tipo}:${u.numero}`, u)
  return map
}

// Unidad real (de la prop `unidades`) + metadata de layout (numberSide) —
// PlanoGrid no sabe nada de reservas ni estados, solo de dónde va cada
// unidad. Si todavía no existe en la base (no debería pasar: 184/184
// verificadas contra unidades.fila/orden, ver auditoría Tarea 1), se le
// pasa a renderCelda un placeholder mínimo con fila del layout para que la
// celda vacía se siga dibujando en su lugar.
function celdaDe(index, tipo, numero, fila, numberSide) {
  const u = index.get(`${tipo}:${numero}`)
  return { ...(u || { tipo, numero, fila }), numberSide }
}

// Dibuja el plano completo (carpas + sombrillas + rótulos fijos) según
// planoLayout.js. `unidades`: lista con al menos { id, numero, tipo, fila,
// orden } — el resto de los campos que tenga cada objeto los decide quien
// la pase (acá no se leen). `renderCelda(unidad)` decide qué pintar en cada
// posición (CRM: <Cell/> con estado de reserva; landing: <CeldaPublica/>
// con libre/bloqueada/seleccionada/sugerida).
export default function PlanoGrid({ unidades, renderCelda }) {
  const index = indexar(unidades)

  return (
    <>
      {/* Row Superior Unificada: Recreación + Acceso + Pileta */}
      <div className="flex justify-center gap-0 items-start mb-6">
        <div style={{ width: PLANO_SECTOR_WIDTH }} className="h-[50px] flex items-center justify-center border border-white/10 rounded-l-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          Recreación
        </div>
        <div style={{ width: PLANO_PASILLO_CENTRAL }} className="h-[50px] flex items-center justify-center border-y border-white/10 bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white">
          Acceso
        </div>
        <div style={{ width: PLANO_SECTOR_WIDTH }} className="h-[122px] bg-sky-500/10 border border-sky-500/30 rounded-r-lg flex flex-col items-center justify-center relative group overflow-hidden">
          <div className="absolute inset-0 bg-sky-400/5" />
          <span className="relative z-10 text-[10px] font-black text-sky-400 uppercase tracking-[0.6em]">Pileta</span>
          <div className="w-12 h-1 bg-sky-400/20 rounded-full mt-2" />
        </div>
      </div>

      {/* Contenedor de Carpas */}
      <div className="flex justify-center items-end pb-12">
        {CARPAS_LAYOUT.map((item, idx) => {
          if (item.tipo === "pasillo") return <div key={idx} style={{ width: item.ancho }} />

          if (item.tipo === "hilera") {
            return (
              <div key={idx} className="flex flex-col gap-1">
                {[...rango(item.rango)].map((numero) =>
                  renderCelda(celdaDe(index, "carpa", numero, item.fila, item.numberSide)),
                )}
              </div>
            )
          }

          return (
            <div key={idx} className="flex items-end" style={{ gap: PLANO_BLOQUE_GAP }}>
              {item.lados.map((lado) => (
                <div key={lado.fila} className="flex flex-col gap-1">
                  {[...rango(lado.rango)].map((numero) =>
                    renderCelda(celdaDe(index, "carpa", numero, lado.fila, lado.numberSide)),
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Sector Sombrillas */}
      <div className="mt-16 flex flex-col items-center">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-[1px] w-12 bg-white/10" />
          <span className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-500">⛱️ Sector Sombrillas</span>
          <div className="h-[1px] w-12 bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-20">
          {[0, 1].map((colIdx) => (
            <div key={colIdx} className="space-y-1">
              {SOMBRILLAS_LAYOUT.filas.map((filaDef) => (
                <div key={filaDef.fila} className="flex gap-1">
                  {[...rango(filaDef.columnas[colIdx])].map((numero) =>
                    renderCelda(celdaDe(index, "sombrilla", numero, filaDef.fila, undefined)),
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 w-full bg-white/5 border border-white/5 py-5 text-center text-gray-600 font-black text-[11px] tracking-[1em] uppercase rounded-2xl">
        Océano Atlántico
      </div>
    </>
  )
}

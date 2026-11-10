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

// Ola: franja con borde superior ondulado (período `p`, amplitud `a`, nivel `y`) que llena hasta
// el pie del viewBox. Más ancha que el viewBox en un período, así el translateX de `.plano-ola`
// (exactamente un período) cierra el ciclo sin saltos.
const MAR_W = 700
const MAR_H = 128
function ola(y, p, a) {
  const tramos = Math.ceil((MAR_W + p) / (p / 2))
  return `M0 ${y}q${p / 4} ${-a} ${p / 2} 0${`t${p / 2} 0`.repeat(tramos - 1)}V${MAR_H}H0Z`
}
const OLA_CLARA = ola(30, 140, 6)
const OLA_MEDIA = ola(52, 175, 7)
const OLA_HONDA = ola(76, 100, 5)

// Mar del modo cliente (pantalla completa): SVG inline propio, 5 paths, sin imágenes. Arena en
// dorado 50 (fondo) y 100 (franja húmeda), 3 capas de azul en tonos de la pileta y una línea de
// espuma. Vive dentro de PlanoGrid, o sea dentro de la capa que gira, y su rótulo contra-gira.
// Las olas se mueven solo con transform (index.css, `.plano-ola`), apagadas con reduced-motion.
function MarCliente() {
  return (
    <div className="mt-16 w-full relative overflow-hidden rounded-2xl border border-[#F7DF96] bg-[#FEFBF3] dark:border-white/10 dark:bg-[#1F1E1C]" data-plano-mar>
      <svg viewBox={`0 0 ${MAR_W} ${MAR_H}`} preserveAspectRatio="none" aria-hidden="true" className="block w-full h-[128px]">
        <path className="dark:fill-[#2A2A28]" d="M0 14q87 8 175 0t175 0 175 0 175 0V50H0Z" fill="#FDF5E0" />
        <path className="plano-ola" style={{ '--ola-p': '100px', animationDuration: '16s' }} d={OLA_HONDA} fill="#8CC8E8" />
        <path className="plano-ola" style={{ '--ola-p': '175px', animationDuration: '22s', animationDirection: 'reverse' }} d={OLA_MEDIA} fill="#B4DCF0" />
        <path className="plano-ola" style={{ '--ola-p': '140px', animationDuration: '18s' }} d={OLA_CLARA} fill="#D6ECF8" />
        <path className="plano-ola" style={{ '--ola-p': '140px', animationDuration: '18s' }} d={`M0 30q35 -6 70 0${'t70 0'.repeat(11)}`} fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <span className="plano-contra text-[11px] font-black uppercase tracking-[1em] text-sky-900 dark:text-sky-100" style={{ paddingLeft: "1em" }}>Océano Atlántico</span>
      </div>
    </div>
  )
}

// Modo oscuro (nov 2026): los rótulos fijos y los recuadros llevan variantes
// `dark:` con valores arbitrarios (ver PORTABILIDAD.md). Solo cambian colores:
// geometría, tamaños, numeración y zoom quedan intactos, y en claro se ve
// exactamente igual que siempre.
//
// Dibuja el plano completo (carpas + sombrillas + rótulos fijos) según
// planoLayout.js. `unidades`: lista con al menos { id, numero, tipo, fila,
// orden } — el resto de los campos que tenga cada objeto los decide quien
// la pase (acá no se leen). `renderCelda(unidad)` decide qué pintar en cada
// posición (CRM: <Cell/> con estado de reserva; landing: <CeldaPublica/>
// con libre/bloqueada/seleccionada/sugerida).
export default function PlanoGrid({ unidades, renderCelda, mar = false }) {
  const index = indexar(unidades)

  return (
    <>
      {/* Row superior: Recreación + Acceso + Pileta. Tres recuadros del mismo tratamiento (radio,
          borde de 1px, 122px de alto) y el mismo ancho total de siempre: cada uno va en un
          contenedor de ancho fijo con 2px de aire a cada lado, así no se mueve ninguna celda. */}
      <div className="flex justify-center gap-0 items-start mb-6">
        <div style={{ width: PLANO_SECTOR_WIDTH }} className="px-0.5">
          <div className="h-[122px] flex items-center justify-center bg-[#FEFBF3] border border-[#F7DF96] rounded-lg dark:bg-[#F2CA50]/[0.08] dark:border-[#F2CA50]/30">
            <span className="plano-contra text-[10px] font-black uppercase tracking-[0.6em] text-gray-500 dark:text-gray-300">Recreación</span>
          </div>
        </div>
        <div style={{ width: PLANO_PASILLO_CENTRAL }} className="px-0.5">
          <div className="h-[122px] flex items-center justify-center bg-[#FEFBF3] border border-[#F7DF96] rounded-lg dark:bg-[#F2CA50]/[0.08] dark:border-[#F2CA50]/30">
            <span className="plano-contra text-[10px] font-black uppercase tracking-[0.6em] text-gray-500 dark:text-gray-300">Acceso</span>
          </div>
        </div>
        <div style={{ width: PLANO_SECTOR_WIDTH }} className="px-0.5">
          <div className="h-[122px] bg-sky-500/10 border border-sky-500/30 rounded-lg flex flex-col items-center justify-center relative group overflow-hidden dark:bg-sky-400/[0.07] dark:border-sky-400/25">
            <div className="absolute inset-0 bg-sky-400/5" />
            <span className="plano-contra relative z-10 text-[10px] font-black text-sky-400 uppercase tracking-[0.6em] dark:text-sky-300">Pileta</span>
            <div className="w-12 h-1 bg-sky-400/20 rounded-full mt-2" />
          </div>
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
          <span className="plano-contra text-[11px] font-black uppercase tracking-[0.5em] text-gray-500 dark:text-gray-300">⛱️ Sector Sombrillas</span>
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

      {mar ? (
        <MarCliente />
      ) : (
        <div className="mt-16 w-full bg-white/5 border border-white/5 py-5 text-center text-gray-600 font-black text-[11px] tracking-[1em] uppercase rounded-2xl dark:bg-white/[0.04] dark:border-white/10 dark:text-gray-300">
          <span className="plano-contra">Océano Atlántico</span>
        </div>
      )}
    </>
  )
}

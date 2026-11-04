import { useEffect, useRef, useState } from 'react'
import ComprobanteDocumento from './ComprobanteDocumento'

// Vista previa del comprobante: el documento oficial (ComprobanteDocumento, sin
// tocarlo) como una "hoja" escalada con transform: scale. La escala sale de
// min(anchoDisponible / anchoDoc, altoDisponible / altoDoc), medida con
// ResizeObserver, así entra completo, con su proporción real, centrado en su
// área y sin scroll. La hoja mide exactamente el documento escalado.
export default function ComprobantePreview({ datos, tipo = 'estado_cuenta', onClick, className = '' }) {
  const area = useRef(null)
  const doc = useRef(null)
  const [medida, setMedida] = useState({ s: 0, w: 0, h: 0 })

  useEffect(() => {
    const a = area.current
    const d = doc.current
    if (!a || !d) return undefined
    const medir = () => {
      const dw = d.offsetWidth
      const dh = d.offsetHeight
      // 4px de aire para el borde y la sombra de la hoja.
      const aw = a.clientWidth - 4
      const ah = a.clientHeight - 4
      if (!dw || !dh || aw <= 0 || ah <= 0) return
      const s = Math.min(aw / dw, ah / dh)
      setMedida((p) => (Math.abs(p.s - s) < 0.0005 && p.w === dw && p.h === dh ? p : { s, w: dw, h: dh }))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(a)
    ro.observe(d)
    return () => ro.disconnect()
  }, [])

  const Hoja = onClick ? 'button' : 'div'
  return (
    <div ref={area} className={`relative flex items-center justify-center overflow-hidden ${className}`} data-comprobante-area>
      <Hoja
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-label={onClick ? 'Ver el comprobante a pantalla completa' : undefined}
        className="hoja-comprobante shrink-0 block text-left p-0 border-0 min-h-0"
        style={{
          width: medida.w * medida.s,
          height: medida.h * medida.s,
          visibility: medida.s ? 'visible' : 'hidden',
          cursor: onClick ? 'zoom-in' : 'default',
        }}
        data-comprobante-hoja
      >
        <div
          ref={doc}
          style={{ width: 'max-content', transform: `scale(${medida.s || 1})`, transformOrigin: '0 0', pointerEvents: 'none' }}
        >
          <ComprobanteDocumento datos={datos} tipo={tipo} />
        </div>
      </Hoja>
    </div>
  )
}

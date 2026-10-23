import ComprobanteDocumento from './ComprobanteDocumento'

// Hoja de impresión del comprobante interno (testing oct 2026, item 15):
// dos copias idénticas (Original / Duplicado) en una misma A4, mitad
// superior y mitad inferior, con línea de corte punteada entre ambas —
// nunca dos hojas. `ComprobanteDocumento.jsx` ya nace pensado para media
// hoja (`.cd-root { min-height: 148mm }`, la mitad de los 297mm de una A4),
// acá solo se la monta dos veces dentro de una página de tamaño fijo
// 210x297mm con @page A4 margin 0 (ver lib/imprimirDocumento.js).
export default function ComprobanteImpresionDoble({ datos, tipo }) {
  return (
    <div style={{ width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '148.5mm', overflow: 'hidden' }}>
        <ComprobanteDocumento datos={datos} tipo={tipo} copia="original" />
      </div>
      <div style={{ height: '148.5mm', overflow: 'hidden', borderTop: '0.3mm dashed #999' }}>
        <ComprobanteDocumento datos={datos} tipo={tipo} copia="duplicado" />
      </div>
    </div>
  )
}

import ComprobanteDocumento from './ComprobanteDocumento'

// Hoja de impresión del comprobante interno (testing oct 2026, item 15):
// dos copias idénticas (Original / Duplicado) en una misma A4, mitad
// superior y mitad inferior, con línea de corte punteada entre ambas —
// nunca dos hojas. `ComprobanteDocumento.jsx` ya nace pensado para media
// hoja (`.cd-root { min-height: 148mm }`, la mitad de los 297mm de una A4),
// acá solo se la monta dos veces dentro de una página de tamaño fijo
// 210x297mm con @page A4 margin 0 (ver lib/imprimirDocumento.js).
// Fix (oct 2026): la segunda copia quedaba desfasada — `borderTop` en un
// div con `height` fijo sin `box-sizing: border-box` SUMA el borde arriba
// de los 148.5mm (148.5 + 0.3 + 148.5 = 297.3mm, más alto que la hoja
// real de 297mm), empujando el contenido más allá del borde inferior de
// la A4. `boxSizing: 'border-box'` en los tres niveles (wrapper + las dos
// mitades) hace que el borde se cuente DENTRO de los 148.5mm de cada
// mitad — el total calza exacto en 297mm, ni un pixel de más ni de menos.
export default function ComprobanteImpresionDoble({ datos, tipo }) {
  return (
    <div style={{ width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ height: '148.5mm', overflow: 'hidden', boxSizing: 'border-box' }}>
        <ComprobanteDocumento datos={datos} tipo={tipo} copia="original" />
      </div>
      <div style={{ height: '148.5mm', overflow: 'hidden', borderTop: '0.3mm dashed #999', boxSizing: 'border-box' }}>
        <ComprobanteDocumento datos={datos} tipo={tipo} copia="duplicado" />
      </div>
    </div>
  )
}

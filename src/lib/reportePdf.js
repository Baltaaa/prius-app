import { invocarFuncion } from './invocarFuncion'

// Cliente del generador único de PDF (Edge Function `generar-reporte-pdf`).
//
// La función genera el PDF del lado servidor con pdf-lib, leyendo SOLO de las
// RPCs (reporte_resumen / resumen_cierre_caja): el PDF no puede mostrar
// números distintos de los de la pantalla. Devuelve una URL firmada corta a un
// bucket privado — nunca se baja el PDF al bundle del front.
//
// La invocación va siempre por `invocarFuncion` (CLAUDE.md): traduce los
// errores a español y marca los de conexión.

/** Pide el PDF y devuelve `{ url, nombre }`. */
export async function generarReportePdf({ modo, desde, hasta, cajaId }) {
  const body = modo === 'cierre' ? { modo: 'cierre', caja_id: cajaId } : { modo: 'periodo', desde, hasta }
  const data = await invocarFuncion('generar-reporte-pdf', { body })
  if (!data?.url) throw new Error('El servidor no devolvió el PDF.')
  return data
}

/**
 * Abre el PDF en una pestaña nueva. En iPhone eso lo abre en el visor nativo,
 * que ya trae compartir e imprimir — es mejor que forzar una descarga.
 *
 * `window.open` se llama con la URL recién obtenida: Safari bloquea los popups
 * que no nacen de un gesto, así que la pestaña se abre primero (en blanco) y
 * se le asigna el destino cuando llega la respuesta.
 */
async function abrirPdf(opciones) {
  const pestania = window.open('', '_blank', 'noopener,noreferrer')
  try {
    const { url } = await generarReportePdf(opciones)
    if (pestania) pestania.location.href = url
    else window.location.href = url
    return url
  } catch (err) {
    pestania?.close()
    throw err
  }
}

/** PDF de un período (Reportes). */
export function descargarReportePdf({ desde, hasta }) {
  return abrirPdf({ modo: 'periodo', desde, hasta })
}

/** PDF del cierre de una caja (Caja diaria y el aviso de cierre). */
export function descargarCierrePdf(cajaId) {
  return abrirPdf({ modo: 'cierre', cajaId })
}

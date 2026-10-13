// Estándar único de exportación CSV del CRM (oct 2026) — un solo armador de
// documento para que Caja (hoy) y Reportes (a futuro) generen archivos con
// la misma estructura: título, metadatos, secciones con encabezado propio y
// fila de total opcional. Prohibido armar CSVs a mano en los módulos —
// ver también `formatos.ts` (fechas/montos/etiquetas) y `descargarCsv.ts`
// (BOM + separador + nombre de archivo).

export type Celda = string | number | null

export interface Seccion {
  titulo: string
  columnas: string[]
  filas: Celda[][]
  /** Fila de cierre de la sección — el builder le antepone "TOTAL" a la primera celda si no la trae ya. */
  filaTotal?: Celda[]
}

export interface DocumentoCsvOpts {
  /** Va en la fila 1 como "PRIUS PLAYA GRANDE — {titulo}". */
  titulo: string
  /** Pares [etiqueta, valor] — una fila por dato, bloque "Etiqueta;Valor". */
  metadatos: [string, string][]
  secciones: Seccion[]
}

const SEP = ';'

// Excel (es-AR) y Sheets abren bien con ";" — solo hace falta comillas
// cuando el valor trae el separador, comillas propias o un salto de línea.
function escaparCelda(valor: Celda): string {
  const s = valor == null ? '' : String(valor)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function fila(celdas: Celda[]): string {
  return celdas.map(escaparCelda).join(SEP)
}

/**
 * Arma el documento CSV completo como un solo string (sin BOM, sin
 * descargar — eso lo hace `descargarCsv.ts`). Formato fijo:
 *   PRIUS PLAYA GRANDE — {titulo}
 *   Etiqueta;Valor         (bloque de metadatos)
 *   (fila en blanco)
 *   TITULO SECCION         (mayúsculas)
 *   Columna1;Columna2;...
 *   dato;dato;...
 *   TOTAL;...              (si filaTotal)
 *   (fila en blanco)
 *   ...siguiente sección...
 */
export function crearDocumentoCsv({ titulo, metadatos, secciones }: DocumentoCsvOpts): string {
  const filas: string[] = []

  filas.push(fila([`PRIUS PLAYA GRANDE — ${titulo}`]))
  for (const [etiqueta, valor] of metadatos) {
    filas.push(fila([etiqueta, valor]))
  }

  for (const seccion of secciones) {
    filas.push('') // separador entre bloques
    filas.push(fila([seccion.titulo.toUpperCase()]))
    filas.push(fila(seccion.columnas))
    for (const f of seccion.filas) filas.push(fila(f))
    if (seccion.filaTotal) {
      const [primera, ...resto] = seccion.filaTotal
      const primeraConTotal = typeof primera === 'string' && primera.toUpperCase().startsWith('TOTAL')
        ? primera
        : `TOTAL${primera ? ` ${primera}` : ''}`
      filas.push(fila([primeraConTotal, ...resto]))
    }
  }

  return filas.join('\r\n')
}

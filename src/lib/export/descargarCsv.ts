// Descarga de un documento CSV ya armado (ver `csvBuilder.ts`) — BOM UTF-8
// (tildes/ñ correctas en Excel es-AR) + nombre de archivo único:
// prius_{modulo}_{AAAA-MM-DD}[_{detalle}].csv

const BOM = '﻿'

export function nombreArchivoCsv(modulo: string, fecha: string, detalle?: string): string {
  const base = `prius_${modulo}_${fecha}`
  return `${detalle ? `${base}_${detalle}` : base}.csv`
}

export function descargarCsv(contenido: string, nombreArchivo: string): void {
  const blob = new Blob([BOM + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

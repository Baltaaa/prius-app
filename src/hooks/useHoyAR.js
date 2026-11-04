import { useEffect, useState } from 'react'
import { hoyAR, msHastaMedianocheAR } from '../lib/fechas'

// "Hoy" en hora argentina que se actualiza solo a las 00:00 ART (y al volver a
// la pestaña, por si el equipo estuvo dormido), sin recargar la app.
export function useHoyAR() {
  const [hoy, setHoy] = useState(hoyAR)
  useEffect(() => {
    let t
    const programar = () => {
      t = setTimeout(() => { setHoy(hoyAR()); programar() }, msHastaMedianocheAR() + 500)
    }
    const alVolver = () => { if (document.visibilityState === 'visible') setHoy(hoyAR()) }
    programar()
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [])
  return hoy
}

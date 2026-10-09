/**
 * Configuración centralizada del módulo de clima del Plano (oct 2026) —
 * único lugar con el spot y las coordenadas. Tanto la Edge Function
 * `clima-playa` (Open-Meteo) como el widget de Windguru en el panel tienen
 * que apuntar al mismo punto geográfico, para que los números que ve Chelo
 * en el chip coincidan con lo que después mira en Windguru.
 */

// Spot "Mar del Plata - Base Naval" en windguru.cz/3640.
export const WINDGURU_SPOT_ID = 3640

// Coordenadas de la Base Naval Mar del Plata (38°02'10"S 57°32'06"W —
// Wikipedia/Wikidata, "Mar del Plata Naval Base"), que es donde windguru.cz
// ancla el spot 3640. No existe un endpoint público de Windguru para leer
// esto en código sin scrapear — quedó tomado a mano de la ubicación real.
export const CLIMA_LAT = -38.0361
export const CLIMA_LON = -57.535

export const CLIMA_TIMEZONE = 'America/Argentina/Buenos_Aires'

// A partir de esta ráfaga (km/h) el chip de clima pasa a estado de alerta
// ("Viento fuerte"). Ajustable sin tocar el resto del código.
export const UMBRAL_RAFAGA_ALERTA_KMH = 35

// Ventana real de pronóstico que pide la Edge Function a Open-Meteo: hoy +
// 14 días (15 días totales). Fuera de esta ventana (pasado, o más de 14 días
// adelante) no hay dato — el chip muestra "Sin pronóstico".
export const CLIMA_FORECAST_DIAS = 15

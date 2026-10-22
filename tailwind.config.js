/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: '#F2CA50',
        'gold-hover': '#E5BF45',
        hairline: '#E5E5E5',
        prius: {
          white: '#FFFFFF',
          black: '#000000',
          background: '#F9F9F9',
          subtle: '#F9F9F9',
          // Superficie gris clara anidada DENTRO de una card blanca (mock
          // Stitch "surface-container-low") — distinta de `subtle`, que es
          // el fondo de página. Ej.: tiles de clima/KPI dentro de una card.
          surface: '#F4F3F3',
          muted: '#999999',
          slate: '#666666',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
        }
      },
      // `display` es la fuente de marca para títulos H1 de pantalla (todas
      // las pantallas del CRM + Login) — antes cada página heredaba
      // Montserrat del body sin querer, y Home.jsx quedó suelto con
      // font-serif (Fraunces) por accidente, sin relación con el resto.
      // El cuerpo de texto sigue siendo Montserrat (body { font-family } en
      // index.css) — este cambio es solo para títulos, no se tocó `sans`.
      //
      // Rediseño "Playa Privada" (oct 2026, fuente: Stitch): el sistema
      // nuevo (src/components/ui-prius/*) usa Inter vía la key `ui` para no
      // pisar `sans`/`display`, que las pantallas todavía no migradas siguen
      // usando. Cuando una pantalla migra a los componentes nuevos, empieza
      // a tirar de `font-ui` en vez de `font-sans`/`font-display` — al
      // terminar Fase 3 (toda la app migrada), `sans`/`display` quedan sin
      // uso y se pueden borrar en una pasada aparte.
      // Escala tipográfica (oct 2026, Bloque 2): Manrope para display (H1,
      // H2, métricas grandes) vía la key `display`, Inter para texto vía
      // `ui`/`sans` — self-hosted con @fontsource-variable, importado una
      // sola vez en src/main.jsx, nunca más Google Fonts CDN.
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'sans-serif'],
        display: ['Manrope Variable', 'Manrope', 'sans-serif'],
        ui: ['Inter Variable', 'Inter', 'sans-serif'],
      },
      // Escala tipográfica del design system "Playa Privada" (DESIGN.md de
      // Stitch), expresada como fontSize con lineHeight/letterSpacing/weight
      // emparejados — solo para las pantallas migradas al sistema nuevo.
      // Bloque 2 (oct 2026): H1 mobile 24/30 (antes 26/32), tracking
      // -0.02em; H1 desktop tope en 32px (headline-lg, sin cambios de
      // tamaño); labels uppercase a tracking 0.08em (antes 0.06em). La
      // fuente Manrope de display/métricas y tabular-nums de metric-xl NO
      // se bakean acá: el plugin fontSize de Tailwind solo lee
      // lineHeight/letterSpacing/fontWeight del segundo elemento de la
      // tupla y descarta en silencio cualquier otra key (fontFamily,
      // fontVariantNumeric) — confirmado con Playwright, el font-family no
      // llegaba al CSS generado. Esas dos quedan en index.css como reglas
      // explícitas sobre las mismas clases, después de @tailwind utilities.
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-lg': ['13px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-md': ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' }],
        // clamp (oct 2026): montos grandes (Total Recaudado, Caja, Ocupación)
        // no entraban en mobile angosto (320-414px) cuando el valor real es
        // largo (ej. "$ 270.058.530") — en vez de partir los dígitos (nunca,
        // ver CLAUDE.md formato de pesos) o dejar que desborden la card, la
        // fuente se reduce proporcionalmente por debajo de ~566px de
        // viewport; en viewports iguales o mayores (6vw*566≈34px) queda
        // igual a los 34px de siempre, sin cambios visuales en desktop.
        'metric-xl': ['clamp(22px, 6vw, 34px)', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      borderRadius: {
        lg: '8px',
        md: '4px',
        sm: '2px',
      },
      // Escala de espaciado del mock Stitch (DESIGN.md) — `gutter`/
      // `margin-mobile`/`margin-desktop` reemplazan los valores viejos del
      // scaffold original (24px/20px/64px), confirmado sin uso en ningún
      // archivo antes de pisarlos.
      spacing: {
        'margin-desktop': '1.25rem',
        'margin': '1.25rem',
        'margin-mobile': '1rem',
        'margin-tablet': '2rem',
        'gutter': '1rem',
        'gutter-sm': '0.75rem',
        'gutter-lg': '1.5rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.25rem',
      },
      // `h-dvh`/`min-h-dvh` (Fase 1 mobile, oct 2026): Tailwind v3 no trae la
      // unidad `dvh` nativa — `h-screen` (100vh) en iOS Safari mide más que
      // lo visible cuando la barra de direcciones está presente, dejando
      // contenido por detrás de ella hasta que el usuario scrollea. El
      // fallback a 100vh para navegadores sin soporte de `dvh` vive en
      // index.css (@supports not (height: 100dvh)).
      height: { dvh: '100dvh' },
      minHeight: { dvh: '100dvh' },
    },
  },
  plugins: [],
}
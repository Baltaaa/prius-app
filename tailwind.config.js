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
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        ui: ['Inter', 'sans-serif'],
      },
      // Escala tipográfica del design system "Playa Privada" (DESIGN.md de
      // Stitch), expresada como fontSize con lineHeight/letterSpacing/weight
      // emparejados — solo para las pantallas migradas al sistema nuevo.
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-lg-mobile': ['26px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-lg': ['13px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-md': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '600' }],
        'metric-xl': ['34px', { lineHeight: '40px', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      borderRadius: {
        lg: '8px',
        md: '4px',
        sm: '2px',
      },
      spacing: {
        'margin-desktop': '64px',
        'margin-mobile': '20px',
        'gutter': '24px',
        'margin-tablet': '2rem',
        'gutter-lg': '1.5rem',
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
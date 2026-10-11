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
        }
      },
      // `display` es la fuente de marca para títulos H1 de pantalla (todas
      // las pantallas del CRM + Login) — antes cada página heredaba
      // Montserrat del body sin querer, y Home.jsx quedó suelto con
      // font-serif (Fraunces) por accidente, sin relación con el resto.
      // El cuerpo de texto sigue siendo Montserrat (body { font-family } en
      // index.css) — este cambio es solo para títulos, no se tocó `sans`.
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
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
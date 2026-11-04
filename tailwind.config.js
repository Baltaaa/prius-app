/** @type {import('tailwindcss').Config} */
// Tokens del sistema de diseño: la especificación completa está en
// design/DESIGN.md. Los valores viven en src/index.css como canales RGB para
// que funcionen los modificadores de opacidad (`bg-card/90`).
import containerQueries from '@tailwindcss/container-queries'

const canal = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: canal('background'),
        card: canal('card'),
        surface: canal('secondary'),
        ink: { DEFAULT: canal('primary'), 2: canal('muted-foreground') },
        'on-ink': canal('primary-foreground'),
        line: canal('border'),
        divider: '#F0EFEA',
        'row-hover': '#FAF9F5',
        overlay: 'rgb(0 0 0 / 0.3)',
        gold: {
          DEFAULT: canal('accent'),
          50: '#FEFBF3',
          100: '#FDF5E0',
          200: '#FAEBBC',
          300: '#F7DF96',
          400: '#F5D573',
          500: canal('accent'),
        },
        chart: { 2: '#3D3D3D', 3: '#8A8A8A' },
        // Pares soft/ink verificados a contraste AA ≥ 4.5:1. Sobre fondo
        // claro el texto usa `ink`: el verde sólido da 3,3:1 sobre blanco.
        success: { DEFAULT: '#16A34A', soft: '#E7F6EC', ink: '#166534' },
        danger: { DEFAULT: '#DC2626', soft: '#FDECEC', ink: '#B91C1C' },
        // Plano congelado (ver "Plano congelado" en index.css): valores del
        // sistema anterior, solo para Cell, CellMobile y compañía.
        plano: {
          slate: '#666666',
          muted: '#999999',
          line: '#E5E5E5',
          surface: '#F4F3F3',
          subtle: '#F9F9F9',
          success: '#16A34A',
        },
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
      },
      // El peso va en la tupla para que la escala sea una sola clase; un
      // `font-*` explícito igual le gana, Tailwind lo emite después.
      fontSize: {
        greeting: ['38px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '400' }],
        page: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '400' }],
        'card-title': ['21px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '500' }],
        // clamp: los montos reales son largos ("$ 270.058.530") y nunca se
        // parten ni desbordan la card; la fuente baja con el viewport.
        kpi: ['clamp(34px, 9vw, 60px)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '400' }],
        stat: ['clamp(22px, 6vw, 30px)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '500' }],
        // Monto protagonista de una card compacta (ej. Caja diaria del sidebar).
        amount: ['clamp(22px, 5.5vw, 24px)', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '500' }],
        'modal-title': ['24px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '500' }],
        row: ['15px', { lineHeight: '20px', fontWeight: '500' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        label: ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },
      borderRadius: {
        card: '24px',
        inner: '16px',
        nav: '14px',
        icon: '12px',
        swatch: '6px',
        bar: '8px',
        'plano-md': '4px',
      },
      // Sistema de espaciado (escala de 4px, ver "Espaciado" en DESIGN.md).
      // page/grid/card/hero cambian por breakpoint con variables de index.css;
      // inner y section son fijos. Fuera de estos y de la escala de Tailwind
      // no se usan valores sueltos (lo vigila scripts/audit-design.mjs).
      spacing: {
        page: 'var(--space-page)',
        grid: 'var(--space-grid)',
        card: 'var(--space-card)',
        hero: 'var(--space-hero)',
        inner: '16px',
        section: '24px',
      },
      maxWidth: { page: '1680px' },
      // Tailwind v3 no trae `dvh`: `h-screen` (100vh) en iOS Safari mide más
      // que lo visible con la barra de direcciones. Fallback en index.css.
      height: { dvh: '100dvh' },
      minHeight: { dvh: '100dvh' },
    },
  },
  plugins: [containerQueries],
}

/** @type {import('tailwindcss').Config} */
// Tokens del sistema de diseño: la especificación completa está en
// design/DESIGN.md. Los valores viven en src/index.css como canales RGB para
// que funcionen los modificadores de opacidad (`bg-card/90`).
import containerQueries from '@tailwindcss/container-queries'

const canal = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`
// Token con alfa propio por tema (`--x-a`): en oscuro bordes y tintes son
// blanco/dorado con alfa; la opacidad de la clase se multiplica encima.
const canalA = (nombre) => `rgb(var(--${nombre}) / calc(var(--${nombre}-a) * <alpha-value>))`

export default {
  // Modo oscuro por tokens (index.css). `dark:` solo para excepciones puntuales.
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: canal('background'),
        card: canal('card'),
        elevated: canal('elevated'),
        surface: canal('secondary'),
        ink: { DEFAULT: canal('primary'), 2: canal('muted-foreground') },
        'on-ink': canal('primary-foreground'),
        line: canalA('border'),
        divider: canalA('divider'),
        'row-hover': canalA('row-hover'),
        overlay: canalA('overlay'),
        // Escala dorada derivada de --brand (index.css); en oscuro 50-300 son --brand con alfa.
        brand: canal('brand'),
        gold: {
          DEFAULT: canal('accent'),
          50: canalA('gold-50'),
          100: canalA('gold-100'),
          200: canalA('gold-200'),
          300: canalA('gold-300'),
          400: canalA('gold-400'),
          500: canal('accent'),
        },
        // Texto sobre dorado sólido: negro en los dos temas.
        'on-gold': canal('on-brand'),
        // Fijos, iguales en los dos temas: velos sobre fotos, cámara, grafito.
        scrim: canal('scrim'),
        'on-scrim': canal('on-scrim'),
        chart: { 2: canal('chart-2'), 3: canal('chart-3') },
        // Pares soft/ink verificados a contraste AA ≥ 4.5:1 en los dos temas.
        // Sobre fondo claro el texto usa `ink`: el verde sólido da 3,3:1 sobre blanco.
        success: { DEFAULT: canal('success'), soft: canalA('success-soft'), ink: canal('success-ink') },
        danger: { DEFAULT: canal('danger'), soft: canalA('danger-soft'), ink: canal('danger-ink') },
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
        // Título de página del topbar en desktop (64px de alto).
        topbar: ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '400' }],
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
      // Superficie grafito (DESIGN.md, "Superficie grafito"): solo el botón "Nueva reserva" del
      // topbar y la card de Caja diaria. Degradé de 135° con un highlight interior de 1px arriba.
      // Valores por tema en index.css (--grafito, --grafito-sombra).
      backgroundImage: {
        grafito: 'var(--grafito)',
      },
      boxShadow: {
        grafito: 'var(--grafito-sombra)',
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

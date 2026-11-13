import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Preload de la tipografía de marca (nov 2026, Tarea 6).
 *
 * Manrope está self-hosted (@fontsource-variable) y Vite le pone un hash al
 * .woff2, así que el `<link rel="preload">` no se puede escribir a mano en
 * el index.html: este plugin lo inyecta con el nombre real del build. Sin
 * preload, la fuente se descubre recién al parsear el CSS y el primer
 * pintado sale con la fuente del sistema.
 */
function preloadManrope() {
  return {
    name: 'prius-preload-manrope',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      // El subset `latin` es el que cubre el español; `latin-ext` trae
      // caracteres que esta app no usa, así que no se precarga.
      const woff2 = Object.keys(ctx.bundle || {}).find(
        (f) => f.includes('manrope-latin-wght') && f.endsWith('.woff2'),
      )
      if (!woff2) return html
      return {
        html,
        tags: [{
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${woff2}`, crossorigin: '' },
          injectTo: 'head-prepend',
        }],
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    preloadManrope(),
    // PWA instalable (nov 2026, Tarea 6). `injectManifest` y no `generateSW`
    // porque el service worker propio (src/sw.js) trae el handler de push.
    // `registerType: 'prompt'`: la versión nueva NO se aplica en caliente —
    // queda esperando y toma el control en el próximo arranque en frío.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: null, // el registro lo hace main.jsx, para poder avisar
      injectManifest: {
        // Solo el shell: JS/CSS con hash, fuentes e íconos. Nada de datos.
        globPatterns: ['**/*.{js,css,html,woff2,webmanifest}', 'icons/icon-*.png', 'icons/apple-touch-icon.png', 'images/prius-icon.png'],
        // Las splash de iOS las usa el sistema al arrancar, no el SW; los
        // placeholders y los logos de patrocinadores no son parte del shell.
        globIgnores: ['**/icons/splash/**', '**/placeholder*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
      manifest: {
        id: '/',
        name: 'Prius',
        short_name: 'Prius',
        description: 'Panel de gestión del balneario Prius Playa Grande — plano, reservas, clientes y caja en tiempo real.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F7F2',
        theme_color: '#F8F7F2',
        lang: 'es-AR',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
    // Una sola copia de React en el grafo de módulos del dev server — sin
    // esto, una dependencia que Vite recién descubre a mitad de sesión
    // (ej. react-day-picker, al abrir "Editar reserva" por primera vez)
    // puede terminar resuelta contra una instancia de React distinta de la
    // que ya tiene montada el árbol, y eso dispara "Invalid hook call" /
    // "Cannot read properties of null (reading 'useMemo')".
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundla estas deps una sola vez: evita que el dev server sirva
  // cientos de módulos sueltos (sobre todo lucide-react) en cada carga, y
  // evita el re-bundle a mitad de sesión (page reload + el bug de arriba)
  // de deps que recién se importan desde una pantalla que no es la inicial
  // (react-day-picker en Reservas, html5-qrcode en Recepción, date-fns).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      '@supabase/supabase-js',
      'react-day-picker',
      'html5-qrcode',
      'date-fns',
    ],
  },
})

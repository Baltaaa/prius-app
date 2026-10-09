import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
